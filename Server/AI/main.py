import os
import argparse
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
import tensorflow as tf
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from tensorflow.keras.utils import to_categorical
import joblib # For saving/loading the scaler

# Import from our ai_model module
from ai_model import (
    build_bee_health_model,
    preprocess_audio,
    preprocess_sensor_data,
    predict_health,
    LABEL_TO_INDEX,
    NUM_STATUS_CLASSES,
    STATUS_LABELS, # For displaying names during prediction
    # Constants that might be needed for data loading or generator
    SENSOR_SEQUENCE_LENGTH,
    NUM_SENSOR_FEATURES
)

# --- Configuration ---
DEFAULT_MODEL_PATH = "trained_models/bee_health_model.keras"
DEFAULT_SCALER_PATH = "trained_models/sensor_scaler.gz"
TRAINING_DATA_DIR = "training_data"
AUDIO_SUBDIR = "audio_data"
SENSOR_SUBDIR = "sensor_history_data"

# This mapping defines the TARGET health score the model should learn
# for a given TRUE status label during training.
# YOU MUST ADJUST THESE VALUES BASED ON YOUR DOMAIN KNOWLEDGE.
STATUS_TO_TARGET_HEALTH_SCORE = {
    "7-queen": 0.9,
    "8-queenless": 0.3,
    "9-swarming": 0.4,
    "10-harvest": 0.85,
    "11-risk": 0.6,
    "12-critical": 0.1
    # Ensure all status IDs from labels.json are covered
}

# --- Data Loading and Preparation for Training ---
def load_training_data(annotations_file, audio_data_path, sensor_data_path):
    """
    Loads annotations, derives target health scores from status labels,
    and prepares file paths for training.
    """
    try:
        annotations_df = pd.read_csv(annotations_file)
        if "status_label_id" not in annotations_df.columns:
            raise ValueError("Annotations CSV must contain 'status_label_id' column.")
    except FileNotFoundError:
        print(f"Error: Annotations file not found at {annotations_file}")
        return [], [], [], []
    except ValueError as ve:
        print(f"Error in annotations file structure: {ve}")
        return [], [], [], []

    audio_filepaths = []
    sensor_filepaths = []
    derived_health_scores = []
    status_indices = []

    for index, row in annotations_df.iterrows():
        audio_filename = row.get("audio_filename")
        sensor_filename = row.get("sensor_history_filename")
        status_id = row.get("status_label_id")

        if not all([audio_filename, sensor_filename, status_id]):
            print(f"Warning: Incomplete row in annotations (index {index}). Skipping.")
            continue

        audio_fp = os.path.join(audio_data_path, audio_filename)
        sensor_fp = os.path.join(sensor_data_path, sensor_filename)
        
        if status_id not in LABEL_TO_INDEX:
            print(f"Warning: Unknown status_label_id '{status_id}' in annotations (row {index}). Skipping.")
            continue
        
        target_health = STATUS_TO_TARGET_HEALTH_SCORE.get(status_id)
        if target_health is None:
            print(f"Warning: status_label_id '{status_id}' (row {index}) not in STATUS_TO_TARGET_HEALTH_SCORE mapping. Skipping.")
            continue

        if os.path.exists(audio_fp) and os.path.exists(sensor_fp):
            audio_filepaths.append(audio_fp)
            sensor_filepaths.append(sensor_fp)
            derived_health_scores.append(target_health)
            status_indices.append(LABEL_TO_INDEX[status_id])
        else:
            if not os.path.exists(audio_fp): print(f"Warning: Audio file not found: {audio_fp}")
            if not os.path.exists(sensor_fp): print(f"Warning: Sensor file not found: {sensor_fp}")

    if not audio_filepaths:
        print("No valid data rows found after processing annotations.")
        return [], [], [], []

    status_one_hot = to_categorical(np.array(status_indices), num_classes=NUM_STATUS_CLASSES)
    return audio_filepaths, sensor_filepaths, np.array(derived_health_scores), status_one_hot


class DataGenerator(tf.keras.utils.Sequence):
    """Generates data for Keras during training."""
    def __init__(self, audio_files, sensor_files, health_labels, status_labels_onehot,
                 batch_size, sensor_scaler, shuffle=True):
        self.audio_files = np.array(audio_files)
        self.sensor_files = np.array(sensor_files)
        self.health_labels = np.array(health_labels)
        self.status_labels_onehot = np.array(status_labels_onehot)
        self.batch_size = batch_size
        self.sensor_scaler = sensor_scaler
        self.shuffle = shuffle
        self.indexes = np.arange(len(self.audio_files))
        if self.shuffle:
            np.random.shuffle(self.indexes)

    def __len__(self):
        return int(np.floor(len(self.audio_files) / self.batch_size))

    def __getitem__(self, index):
        batch_indexes = self.indexes[index * self.batch_size:(index + 1) * self.batch_size]

        batch_audio_files_paths = self.audio_files[batch_indexes]
        batch_sensor_files_paths = self.sensor_files[batch_indexes]

        X_audio = np.array([preprocess_audio(fp) for fp in batch_audio_files_paths])
        X_sensor = np.array([preprocess_sensor_data(fp, scaler=self.sensor_scaler) for fp in batch_sensor_files_paths])

        y_health = self.health_labels[batch_indexes]
        y_status = self.status_labels_onehot[batch_indexes]

        return [X_audio, X_sensor], {'health_score': y_health, 'status_labels': y_status}

    def on_epoch_end(self):
        if self.shuffle:
            np.random.shuffle(self.indexes)


def fit_sensor_scaler(sensor_filepaths_list):
    """Fits a StandardScaler on the sensor data from the provided file paths."""
    print("Fitting sensor data scaler...")
    all_sensor_sequences = []
    for fp in sensor_filepaths_list:
        # preprocess_sensor_data without scaler returns unscaled data
        # We need the raw data to fit the scaler properly
        try:
            df = pd.read_csv(fp)
            required_cols = ['temperature', 'humidity', 'pressure']
            if not all(col in df.columns for col in required_cols):
                print(f"Warning: Missing required columns in {fp} for scaler fitting. Skipping.")
                continue

            if len(df) < SENSOR_SEQUENCE_LENGTH:
                # print(f"Warning: Not enough data in {fp} for sequence length {SENSOR_SEQUENCE_LENGTH}. Skipping for scaler fitting.")
                # Or implement padding here for fitting too, but can skew scaler if many are padded
                num_to_pad = SENSOR_SEQUENCE_LENGTH - len(df)
                padding_df = pd.concat([df.iloc[[0]]] * num_to_pad, ignore_index=True)
                df_sequence = pd.concat([padding_df, df], ignore_index=True).tail(SENSOR_SEQUENCE_LENGTH)
            else:
                df_sequence = df.tail(SENSOR_SEQUENCE_LENGTH)
            
            all_sensor_sequences.append(df_sequence[required_cols].values.astype(np.float32))

        except Exception as e:
            print(f"Skipping {fp} for scaler fitting due to error: {e}")
            continue
    
    if not all_sensor_sequences:
        print("Warning: No valid sensor data to fit the scaler. Using a dummy scaler (NOT RECOMMENDED).")
        scaler = StandardScaler()
        scaler.fit(np.zeros((1, NUM_SENSOR_FEATURES))) # Fit on dummy data
        return scaler

    # Concatenate all sequences: list of (SEQ_LEN, FEATURES) arrays into one big (N*SEQ_LEN, FEATURES) array
    stacked_sensor_data = np.concatenate(all_sensor_sequences, axis=0)
    
    scaler = StandardScaler()
    scaler.fit(stacked_sensor_data)
    print("Sensor data scaler fitted.")
    return scaler


# --- Training Function ---
def train_model(annotations_file, model_save_path, scaler_save_path, epochs=50, batch_size=16, val_split=0.2):
    """Trains the bee health model."""
    if NUM_STATUS_CLASSES == 0:
        print("Error: NUM_STATUS_CLASSES is 0. Cannot train. Check labels.json.")
        return

    audio_data_path = os.path.join(TRAINING_DATA_DIR, AUDIO_SUBDIR)
    sensor_data_path = os.path.join(TRAINING_DATA_DIR, SENSOR_SUBDIR)

    print("Loading training data...")
    audio_files, sensor_files, derived_health_labels, status_labels_onehot = load_training_data(
        annotations_file, audio_data_path, sensor_data_path
    )

    if not audio_files:
        print("No training data loaded. Exiting training.")
        return

    # Stratify by status_labels_onehot requires 1D array of class indices
    class_indices_for_stratify = np.argmax(status_labels_onehot, axis=1)
    stratify_option = class_indices_for_stratify if len(np.unique(class_indices_for_stratify)) > 1 else None

    (audio_train, audio_val,
     sensor_train, sensor_val,
     health_train, health_val,
     status_train, status_val) = train_test_split(
        audio_files, sensor_files, derived_health_labels, status_labels_onehot,
        test_size=val_split, random_state=42, shuffle=True,
        stratify=stratify_option
    )

    print(f"Training samples: {len(audio_train)}, Validation samples: {len(audio_val)}")
    if len(audio_train) == 0 or len(audio_val) == 0 :
        print("Not enough data for training/validation split after processing. Need more valid annotated samples.")
        return
    if len(audio_train) < batch_size or len(audio_val) < batch_size:
        print(f"Warning: Number of training ({len(audio_train)}) or validation ({len(audio_val)}) samples is less than batch_size ({batch_size}). Adjust batch_size or add more data.")
        # Potentially adjust batch_size here if desired, or let it fail/warn during generator creation.

    sensor_scaler = fit_sensor_scaler(sensor_train) # Pass list of file paths for training sensor data
    joblib.dump(sensor_scaler, scaler_save_path)
    print(f"Sensor scaler saved to {scaler_save_path}")

    train_generator = DataGenerator(audio_train, sensor_train, health_train, status_train,
                                    batch_size, sensor_scaler, shuffle=True)
    val_generator = DataGenerator(audio_val, sensor_val, health_val, status_val,
                                  batch_size, sensor_scaler, shuffle=False)

    if len(train_generator) == 0 or len(val_generator) == 0:
        print("Error: Data generators are empty (likely due to insufficient data for batch_size). Exiting training.")
        return

    print("Building model...")
    model = build_bee_health_model(NUM_STATUS_CLASSES) # NUM_STATUS_CLASSES from ai_model
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss={
            'health_score': 'mean_squared_error',
            'status_labels': 'categorical_crossentropy'
        },
        metrics={
            'health_score': ['mae', tf.keras.metrics.RootMeanSquaredError(name='rmse')],
            'status_labels': 'accuracy'
        },
        loss_weights={'health_score': 0.5, 'status_labels': 0.5}
    )
    model.summary()

    callbacks = [
        EarlyStopping(monitor='val_loss', patience=10, verbose=1, restore_best_weights=True),
        ModelCheckpoint(model_save_path, monitor='val_loss', save_best_only=True, verbose=1),
        ReduceLROnPlateau(monitor='val_loss', factor=0.2, patience=5, min_lr=1e-6, verbose=1)
    ]

    print("Starting training...")
    history = model.fit(
        train_generator,
        validation_data=val_generator,
        epochs=epochs,
        callbacks=callbacks,
        workers=max(1, os.cpu_count() // 2 -1 ) if os.cpu_count() and os.cpu_count() > 1 else 1,
        use_multiprocessing=True if os.cpu_count() and os.cpu_count() > 2 else False
    )

    print("Training finished.")
    if history and history.history and 'val_loss' in history.history and history.history['val_loss']:
        print(f"Best validation loss: {min(history.history['val_loss']):.4f}")
    else:
        print("Training completed, but validation loss history is not available or is empty.")


# --- Main Execution ---
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="VcelJAK AI Model Training and Prediction")
    parser.add_argument("mode", choices=["train", "predict"], help="Mode of operation")
    parser.add_argument("--annotations", default=os.path.join(TRAINING_DATA_DIR, "annotations.csv"),
                        help="Path to the annotations CSV file (for training)")
    parser.add_argument("--model_path", default=DEFAULT_MODEL_PATH,
                        help="Path to save/load the Keras model file")
    parser.add_argument("--scaler_path", default=DEFAULT_SCALER_PATH,
                        help="Path to save/load the sensor data scaler file")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Training batch size")
    parser.add_argument("--audio_file", help="Path to audio file for prediction")
    parser.add_argument("--sensor_file", help="Path to sensor history CSV file for prediction")

    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.model_path), exist_ok=True)
    os.makedirs(os.path.dirname(args.scaler_path), exist_ok=True)

    if args.mode == "train":
        if not os.path.exists(args.annotations):
            print(f"Annotations file not found: {args.annotations}")
            print("Please create an annotations.csv or specify its path.")
        else:
            train_model(args.annotations, args.model_path, args.scaler_path, args.epochs, args.batch_size)

    elif args.mode == "predict":
        if not args.audio_file or not args.sensor_file:
            parser.error("For prediction, --audio_file and --sensor_file must be provided.")
        if not os.path.exists(args.model_path):
            parser.error(f"Trained model not found at {args.model_path}. Train a model first.")
        if not os.path.exists(args.scaler_path):
            parser.error(f"Sensor scaler not found at {args.scaler_path}. It's created during training.")

        print(f"Loading model from {args.model_path}...")
        try:
            model = tf.keras.models.load_model(args.model_path)
            print("Model loaded.")
        except Exception as e:
            print(f"Error loading Keras model: {e}")
            exit()

        print(f"Loading sensor scaler from {args.scaler_path}...")
        try:
            sensor_scaler = joblib.load(args.scaler_path)
            print("Sensor scaler loaded.")
        except Exception as e:
            print(f"Error loading sensor scaler: {e}")
            exit()

        prediction_results = predict_health(model, args.audio_file, args.sensor_file, sensor_scaler=sensor_scaler)
        
        if prediction_results:
            print("\n--- Prediction Results ---")
            print(f"Evaluated Health Score: {prediction_results['health_score']:.4f}")
            print(f"Predicted Status: {prediction_results['predicted_status_name']} (ID: {prediction_results['predicted_status_id']})")
            print(f"Description: {prediction_results['predicted_status_description']}")
            print("Status Probabilities:")
            for status_id_key, prob in prediction_results['status_probabilities'].items():
                status_name_display = "Unknown"
                for label_obj_display in STATUS_LABELS: # STATUS_LABELS from ai_model
                    if label_obj_display.get("id") == status_id_key:
                        status_name_display = label_obj_display.get("name", "Unknown")
                        break
                print(f"  - {status_name_display} ({status_id_key}): {prob:.4f}")
        else:
            print("Prediction failed or returned no results.")
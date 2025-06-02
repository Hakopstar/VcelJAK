import json
import numpy as np
import pandas as pd
import librosa
import tensorflow as tf
from tensorflow.keras.layers import (
    Input, Conv2D, ReLU, BatchNormalization, MaxPooling2D,
    GlobalAveragePooling2D, Dense, Dropout, concatenate, LSTM
)
from tensorflow.keras.models import Model
# StandardScaler bude importován v main.py a předán jako argument, aby se předešlo cyklickým importům

# --- Label Configuration ---
def load_labels_config(filepath="labels.json"):
    """Loads label definitions from a JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            labels_data = json.load(f)
    except FileNotFoundError:
        print(f"FATAL ERROR: labels.json not found at {filepath}. Please ensure it exists.")
        # V reálné aplikaci by zde mohlo dojít k ukončení nebo vyvolání výjimky
        return [], {}, {}, 0

    status_labels_list = [label for label in labels_data if label.get("type") == "status"]
    if not status_labels_list:
        print("FATAL ERROR: No labels with type 'status' found in labels.json.")
        return [], {}, {}, 0

    label_to_index_map = {label["id"]: i for i, label in enumerate(status_labels_list)}
    index_to_label_map = {i: label["id"] for i, label in enumerate(status_labels_list)}
    num_classes = len(status_labels_list)
    return status_labels_list, label_to_index_map, index_to_label_map, num_classes

STATUS_LABELS, LABEL_TO_INDEX, INDEX_TO_LABEL, NUM_STATUS_CLASSES = load_labels_config()

# --- Audio Preprocessing Constants ---
SAMPLE_RATE = 48000
AUDIO_DURATION = 30  # seconds
N_MELS = 128
N_FFT = 2048
HOP_LENGTH = 512
EXPECTED_AUDIO_TIME_FRAMES = (SAMPLE_RATE * AUDIO_DURATION) // HOP_LENGTH + 1

# --- Sensor Preprocessing Constants ---
SENSOR_SEQUENCE_LENGTH = 24 # Number of historical sensor readings
NUM_SENSOR_FEATURES = 3   # Temperature, Humidity, Pressure

# --- Audio Preprocessing Function ---
def preprocess_audio(audio_file_path, target_sr=SAMPLE_RATE, duration=AUDIO_DURATION,
                     n_mels=N_MELS, n_fft=N_FFT, hop_length=HOP_LENGTH,
                     expected_time_frames=EXPECTED_AUDIO_TIME_FRAMES):
    """
    Loads an audio file, resamples it, pads/truncates to a fixed duration,
    and computes a log-Mel spectrogram. Ensures fixed output dimensions.
    """
    try:
        y, sr = librosa.load(audio_file_path, sr=None, mono=True)

        if sr != target_sr:
            y = librosa.resample(y, orig_sr=sr, target_sr=target_sr)
        sr = target_sr # Update sr to target_sr after resampling

        target_length = int(sr * duration) # Ensure target_length is an integer
        if len(y) < target_length:
            y = np.pad(y, (0, target_length - len(y)), mode='constant')
        else:
            y = y[:target_length]

        mel_spectrogram = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=n_fft,
                                                         hop_length=hop_length, n_mels=n_mels)
        log_mel_spectrogram = librosa.power_to_db(mel_spectrogram, ref=np.max)

        mean = np.mean(log_mel_spectrogram)
        std = np.std(log_mel_spectrogram)
        if std < 1e-8:
            std = 1e-8
        log_mel_spectrogram_normalized = (log_mel_spectrogram - mean) / std
        
        # Ensure fixed time dimension
        current_time_frames = log_mel_spectrogram_normalized.shape[1]
        if current_time_frames < expected_time_frames:
            pad_width = expected_time_frames - current_time_frames
            log_mel_spectrogram_normalized = np.pad(log_mel_spectrogram_normalized, ((0,0), (0,pad_width)), mode='constant')
        elif current_time_frames > expected_time_frames:
            log_mel_spectrogram_normalized = log_mel_spectrogram_normalized[:, :expected_time_frames]

        log_mel_spectrogram_normalized = log_mel_spectrogram_normalized[..., np.newaxis]
        return log_mel_spectrogram_normalized

    except Exception as e:
        print(f"Error processing audio file {audio_file_path}: {e}")
        return np.zeros((n_mels, expected_time_frames, 1), dtype=np.float32)

# --- Sensor Data Preprocessing Function ---
def preprocess_sensor_data(sensor_history_file_path,
                           sequence_length=SENSOR_SEQUENCE_LENGTH,
                           num_features=NUM_SENSOR_FEATURES,
                           scaler=None): # scaler is an instance of a fitted sklearn.preprocessing.StandardScaler
    """
    Loads sensor history, takes the last `sequence_length` records,
    and normalizes features using the provided scaler.
    """
    try:
        df = pd.read_csv(sensor_history_file_path)
        required_cols = ['temperature', 'humidity', 'pressure']
        if not all(col in df.columns for col in required_cols):
            raise ValueError(f"Sensor CSV {sensor_history_file_path} must contain columns: {required_cols}")

        if len(df) < sequence_length:
            # Pad with the first available record if not enough history
            num_to_pad = sequence_length - len(df)
            padding_df = pd.concat([df.iloc[[0]]] * num_to_pad, ignore_index=True)
            df_sequence = pd.concat([padding_df, df], ignore_index=True).tail(sequence_length)
        else:
            df_sequence = df.tail(sequence_length)

        sensor_values = df_sequence[required_cols].values.astype(np.float32)

        if sensor_values.shape != (sequence_length, num_features):
             # This might happen if padding logic or data is inconsistent
             print(f"Warning: Sensor data shape mismatch for {sensor_history_file_path}. Expected ({sequence_length}, {num_features}), got {sensor_values.shape}. Returning zeros.")
             return np.zeros((sequence_length, num_features), dtype=np.float32)

        if scaler:
            sensor_values = scaler.transform(sensor_values)
        else:
            # This case should ideally not happen during training/prediction if scaler is always fitted/loaded
            print(f"Warning: No scaler provided for sensor data {sensor_history_file_path}. Data will not be scaled.")

        return sensor_values

    except Exception as e:
        print(f"Error processing sensor history file {sensor_history_file_path}: {e}")
        return np.zeros((sequence_length, num_features), dtype=np.float32)


# --- Model Architecture Definition ---
def build_bee_health_model(num_status_classes,
                           audio_input_shape=(N_MELS, EXPECTED_AUDIO_TIME_FRAMES, 1),
                           sensor_input_shape=(SENSOR_SEQUENCE_LENGTH, NUM_SENSOR_FEATURES)):
    """Builds the combined CNN (audio) and LSTM (sensor) model."""

    # --- Audio Branch (CNN) ---
    audio_input = Input(shape=audio_input_shape, name="audio_input")
    x = Conv2D(32, (3, 3), padding="same")(audio_input) # Output: (None, N_MELS, FRAMES, 32)
    x = ReLU()(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x) # Output: (None, N_MELS/2, FRAMES/2, 32)

    x = Conv2D(64, (3, 3), padding="same")(x)
    x = ReLU()(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x) # Output: (None, N_MELS/4, FRAMES/4, 64)

    x = Conv2D(128, (3, 3), padding="same")(x)
    x = ReLU()(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x) # Output: (None, N_MELS/8, FRAMES/8, 128)

    x = Conv2D(256, (3, 3), padding="same")(x)
    x = ReLU()(x)
    x = BatchNormalization()(x)
    x = MaxPooling2D((2, 2))(x) # Output: (None, N_MELS/16, FRAMES/16, 256)

    x = Conv2D(512, (3, 3), padding="same")(x)
    x = ReLU()(x)
    x = BatchNormalization()(x)
    # No pooling, or adaptive pooling if dimensions become too small

    x = Conv2D(512, (3, 3), padding="same")(x)
    x = ReLU()(x)
    x = BatchNormalization()(x)

    audio_features = GlobalAveragePooling2D(name="audio_gap")(x) # Output: (None, 512)
    audio_features = Dense(256, activation='relu', name="audio_dense_features")(audio_features) # Output: (None, 256)
    audio_features = Dropout(0.3, name="audio_dropout")(audio_features)

    # --- Sensor Branch (LSTM) ---
    sensor_input = Input(shape=sensor_input_shape, name="sensor_input") # (None, SEQ_LENGTH, NUM_FEATURES)
    y = LSTM(64, return_sequences=True, dropout=0.2, recurrent_dropout=0.2, name="lstm_1")(sensor_input) # (None, SEQ_LENGTH, 64)
    y = LSTM(64, dropout=0.2, recurrent_dropout=0.2, name="lstm_2")(y) # (None, 64)
    sensor_features = Dense(32, activation='relu', name="sensor_dense_features")(y) # (None, 32)
    sensor_features = Dropout(0.2, name="sensor_dropout")(sensor_features)

    # --- Fusion and Output Head ---
    combined_features = concatenate([audio_features, sensor_features], name="combined_features") # (None, 256+32=288)

    common_layer = Dense(128, activation='relu', name="common_dense_1")(combined_features) # (None, 128)
    common_layer = Dropout(0.3, name="common_dropout")(common_layer)

    health_score_output = Dense(1, activation='sigmoid', name='health_score')(common_layer) # (None, 1)
    status_labels_output = Dense(num_status_classes, activation='softmax', name='status_labels')(common_layer) # (None, NUM_CLASSES)

    model = Model(
        inputs=[audio_input, sensor_input],
        outputs={'health_score': health_score_output, 'status_labels': status_labels_output}, # Using dict for outputs
        name="BeeHealthModel"
    )
    return model

# --- Prediction Function ---
def predict_health(model_instance, audio_file_path, sensor_history_file_path, sensor_scaler=None):
    """Performs prediction using the loaded model and scaler."""
    processed_audio = preprocess_audio(audio_file_path)
    processed_sensors = preprocess_sensor_data(sensor_history_file_path, scaler=sensor_scaler)

    if processed_audio is None or processed_sensors is None:
        print("Error in preprocessing inputs for prediction. Cannot proceed.")
        return None # Or raise an exception

    processed_audio_batch = np.expand_dims(processed_audio, axis=0)
    processed_sensors_batch = np.expand_dims(processed_sensors, axis=0)

    try:
        predictions = model_instance.predict([processed_audio_batch, processed_sensors_batch])
        health_score_pred = predictions['health_score'][0][0]
        status_probabilities_pred = predictions['status_labels'][0]
    except Exception as e:
        print(f"Error during model prediction: {e}")
        return None


    predicted_status_index = np.argmax(status_probabilities_pred)
    predicted_status_id = INDEX_TO_LABEL.get(predicted_status_index, "unknown_index")
    
    predicted_status_info_dict = {"name": "Unknown Status", "description": "N/A"} # Default
    for label_obj in STATUS_LABELS:
        if label_obj.get("id") == predicted_status_id:
            predicted_status_info_dict = label_obj
            break


    all_status_probs_dict = {
        INDEX_TO_LABEL.get(i, f"unknown_idx_{i}"): float(prob)
        for i, prob in enumerate(status_probabilities_pred)
    }

    return {
        "health_score": float(health_score_pred),
        "predicted_status_id": predicted_status_id,
        "predicted_status_name": predicted_status_info_dict.get("name"),
        "predicted_status_description": predicted_status_info_dict.get("description"),
        "status_probabilities": all_status_probs_dict
    }

if __name__ == '__main__':
    print("AI Model Module (ai_model.py) Loaded.")
    if NUM_STATUS_CLASSES > 0:
        print(f"Number of status classes configured: {NUM_STATUS_CLASSES}")
        print(f"Example label config: {STATUS_LABELS[0] if STATUS_LABELS else 'No labels found'}")
        print(f"Expected audio input shape for model: {(N_MELS, EXPECTED_AUDIO_TIME_FRAMES, 1)}")
        print(f"Expected sensor input shape for model: {(SENSOR_SEQUENCE_LENGTH, NUM_SENSOR_FEATURES)}")

        try:
            # Build a dummy model for syntax check
            model = build_bee_health_model(NUM_STATUS_CLASSES)
            # model.summary() # Can be verbose
            print("Model architecture built successfully (syntax check).")
        except Exception as e:
            print(f"Error building model architecture: {e}")
    else:
        print("No status classes found. Please check labels.json and its loading.")
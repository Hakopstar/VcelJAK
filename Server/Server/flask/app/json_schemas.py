##########################################
# JSON SCHEMA - new testing parameters
# Last version of update: v0.81
# API Version 3.1v
##########################################

# Sensor Object
sensor_schema = {
	"type": "object",
	"properties": {
		"info": {
			"type": "object",
			"properties": {
				"api_version": {"type": "number"}
			},
			"required": [
				"api_version"
			]
		},
		"data": {
			"type": "array",
			"items": 
            {
				"type": "object",
				"properties": {
					"id": {"type": "string"}, 
                    "time": {"type": "string"}, 
                    "unit": {"type": "string"}, 
                    "value": {"type": "number"}
				},
				"required": [
					"id",
					"time",
					"unit",
					"value"
				],
                "additionalProperties": False
			}
		}
	},
	"required": [
		"info",
		"data"
	],
    "additionalProperties": False
}

# Diagnostics Object
diagnostics_schema = {
	"type": "object",
	"properties": {
		"general_information": {
			"type": "object",
			"properties": {
				"caused_by": {"type": "string"},
				"time_to_generate": {"type": "number"}
			},
			"required": [
				"caused_by",
				"time_to_generate"
			],
            "additionalProperties": False
		},
		"system_information": {
			"type": "object",
			"properties": {
				"version": {"type": "string"},
				"api_version": {"type": "string"},
				"connected_devices": {"type": "number"}
			},
			"required": [
				"version",
				"api_version",
				"connected_devices"
			],
            "additionalProperties": False
		},
		"configuration": {
			"type": "object",
			"properties": {
				"system_time_unit": {"type": "string"},
				"temperature_unit": {"type": "string"},
				"voltage_unit": {"type": "string"},
				"power_unit": {"type": "string"},
				"speed_unit": {"type": "string"},
				"weight_unit": {"type": "string"},
				"sound_pressure_level_unit": {"type": "string"},
				"network_strenght_unit": {"type": "string"}
			}
		},
		"status": {
			"type": "object",
			"properties": {
				"power": {
					"type": "object",
					"properties": {
						"power_mode": {"type": "string"},
						"power_usage_mode": {"type": "string"},
						"using": {"type": "number"},
						"battery": {
							"type": "object",
							"properties": {
								"available": {"type": "boolean"},
								"charging": {"type": "boolean"},
								"percentage": {"type": "number"},
								"voltage": {"type": "number"}
							},
							"required": [
								"available"
							],
                            "additionalProperties": False
						},
						"solar": {
							"type": "object",
							"properties": {
								"available": {"type": "boolean"},
								"solar_status": {"type": "string"},
								"solar_wattage": {"type": "number"}
							},
							"required": [
								"available"
							],
                            "additionalProperties": False
						}
					},
					"required": [
						"power_mode",
						"power_usage_mode",
						"using",
						"battery",
						"solar"
					],
                    "additionalProperties": False
				},
				"network": {
					"type": "object",
					"properties": {
						"signal_strenght": {
							"type": "object",
							"properties": {
								"connected": {"type": "boolean"},
								"main_signal": {"type": "number"},
								"connected_sensors": {
									"type": "array",
									"items": 
										{
											"type": "object",
											"properties": {
												"id": {"type": "string"},
												"name": {"type": "string"},
												"signal_value": {"type": "string"},
												"wired": {"type": "boolean"}
											},
											"required": [
												"id",
												"name",
												"signal_value",
												"wired"
											],
                                            "additionalProperties": False
										}
								}
							},
							"required": [
								"connected",
								"main_signal",
								"connected_sensors"
							],
                            "additionalProperties": False
						}
					},
					"required": [
						"signal_strenght"
					],
                    "additionalProperties": False
				}
			},
			"required": [
				"power",
				"network"
			],
            "additionalProperties": False
		}
	},
	"required": [
		"general_information",
		"system_information",
		"configuration",
		"status"
	],
    "additionalProperties": False
}

newsession_request_schema = {
  "type": "object",
  "properties": {
    "api_version": {"type": "string"},
    "key": {"type": "string"},
    "system_id": {"type": "string"},
    "config": {
      "type": "object",
      "properties": {
        "available": {"type": "string"},
        "system_time_unit": {"type": "string"},
        "temperature_unit": {"type": "string"},
        "pressure_unit": {"type": "string"},
        "voltage_unit": {"type": "string"},
        "power_unit": {"type": "string"},
        "speed_unit": {"type": "string"},
        "weight_unit": {"type": "string"},
        "sound_pressure_level_unit": {"type": "string"},
        "network_strenght_unit": {"type": "string"},
        "memory_unit": {"type": "string"}
      },
      "required": [
        "available",
        "system_time_unit",
        "temperature_unit",
        "voltage_unit",
        "power_unit",
        "speed_unit",
        "weight_unit",
        "sound_pressure_level_unit",
        "network_strenght_unit"
      ],
      "additionalProperties": False
    },
    "calibration_settings": {
      "type": "object",
      "properties": {
        "last_calibration": {"type": "string"},
        "calibration_weight": {"type": "number"},
        "calibration_weight_value": {"type": "number"}
      },
      "required": [
        "last_calibration",
        "calibration_weight",
        "calibration_weight_value"
      ],
      "additionalProperties": False
    }
  },
  "required": [
    "api_version",
    "key",
    "system_id",
    "config",
    "calibration_settings"
  ],
  "additionalProperties": False
}
# END
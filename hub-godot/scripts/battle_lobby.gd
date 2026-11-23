extends "res://scripts/world.gd"

# Stable Lamma social-world lobby.
# Keep the original player, camera, mobile controls and Firebase presence.
# The web export uses the Compatibility renderer so it can run in WebView.

func _ready() -> void:
	camera_distance = 2.35
	camera_pitch = -0.12
	super._ready()
	_update_camera(1.0)

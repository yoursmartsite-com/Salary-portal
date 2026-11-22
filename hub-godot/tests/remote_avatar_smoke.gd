extends SceneTree

func _initialize() -> void:
	call_deferred("_run_remote_avatar_test")

func _run_remote_avatar_test() -> void:
	var world := Node3D.new()
	world.set_script(load("res://scripts/world.gd"))
	root.add_child(world)

	var now_ms := Time.get_unix_time_from_system() * 1000.0
	var sample := {
		"smoke_room": {
			"game": {"type": "lamma_hub"},
			"players": {
				"smoke_user": {
					"uid": "smoke_user",
					"name": "Smoke User",
					"position": {"x": 1.0, "y": 0.1, "z": 2.0},
					"yaw": 0.4,
					"updatedAt": now_ms
				}
			}
		}
	}
	world.call("_on_firebase_players_changed", sample)

	var avatars: Dictionary = world.get("remote_avatars")
	if avatars.size() != 1 or not avatars.has("smoke_user"):
		push_error("Remote avatar was not created from Firebase player data")
		quit(1)
		return

	var avatar: Node3D = avatars["smoke_user"]
	if avatar.get_node_or_null("PlayerCollision") == null:
		push_error("Remote avatar collision body is missing")
		quit(1)
		return
	if avatar.get_node_or_null("PlayerName") == null:
		push_error("Remote avatar name tag is missing")
		quit(1)
		return

	world.call("_update_remote_players", 0.1)
	if avatar.global_position.distance_to(Vector3(1.0, 0.1, 2.0)) > 0.5:
		push_error("Remote avatar position interpolation failed")
		quit(1)
		return

	world.queue_free()
	quit(0)

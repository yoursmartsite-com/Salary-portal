extends SceneTree

func _initialize() -> void:
	call_deferred("_run_remote_avatar_test")

func _run_remote_avatar_test() -> void:
	var world := Node3D.new()
	world.set_script(load("res://scripts/world.gd"))
	world.set_meta("skip_firebase", true)
	root.add_child(world)

	var forward: Vector3 = world.call("_camera_relative_direction", Vector2(0, -1))
	var backward: Vector3 = world.call("_camera_relative_direction", Vector2(0, 1))
	var right: Vector3 = world.call("_camera_relative_direction", Vector2(1, 0))
	var left: Vector3 = world.call("_camera_relative_direction", Vector2(-1, 0))
	if right.distance_to(Vector3(1, 0, 0)) > 0.001:
		push_error("Joystick right must move the avatar toward +X")
		quit(1)
		return
	if left.distance_to(Vector3(-1, 0, 0)) > 0.001:
		push_error("Joystick left must move the avatar toward -X")
		quit(1)
		return
	if absf(float(world.call("_yaw_for_direction", right)) + PI / 2.0) > 0.001:
		push_error("Right travel must face toward +X")
		quit(1)
		return
	if absf(float(world.call("_yaw_for_direction", left)) - PI / 2.0) > 0.001:
		push_error("Left travel must face toward -X")
		quit(1)
		return
	if forward.distance_to(Vector3(0, 0, -1)) > 0.001:
		push_error("Joystick up must move the avatar forward (-Z)")
		quit(1)
		return
	if backward.distance_to(Vector3(0, 0, 1)) > 0.001:
		push_error("Joystick down must move the avatar backward (+Z)")
		quit(1)
		return
	if absf(float(world.call("_yaw_for_direction", forward))) > 0.001:
		push_error("Forward travel must face the character toward -Z")
		quit(1)
		return
	if absf(absf(float(world.call("_yaw_for_direction", backward))) - PI) > 0.001:
		push_error("Backward travel must turn the character toward +Z")
		quit(1)
		return

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

	world.call("_on_portal_enter", "اختبار", "../games/connect-four.html")
	var portal_button: Button = world.get("portal_enter_button")
	if portal_button == null:
		push_error("Portal entry button was not created")
		quit(1)
		return
	if not portal_button.visible or portal_button.text != "دخول: اختبار":
		push_error("Portal entry prompt did not appear")
		quit(1)
		return
	world.call("_on_portal_exit", "../games/connect-four.html")
	if portal_button.visible:
		push_error("Portal entry prompt did not hide after exit")
		quit(1)
		return

	world.queue_free()
	quit(0)

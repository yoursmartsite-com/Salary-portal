extends SceneTree

func _initialize() -> void:
	call_deferred("_run_mobile_controls_test")

func _run_mobile_controls_test() -> void:
	var config_path := "user://lamma_hub_controls.cfg"
	if FileAccess.file_exists(config_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(config_path))

	var world := Node3D.new()
	world.set_script(load("res://scripts/world.gd"))
	world.set_meta("skip_firebase", true)
	root.add_child(world)
	await process_frame

	var joystick: Control = world.get("joystick_base")
	var run_button: Button = world.get("run_button")
	var jump_button: Button = world.get("jump_button")
	var settings_button: Button = world.get("settings_button")
	var free_look_button: Button = world.get("free_look_button")
	if joystick == null or run_button == null or jump_button == null or settings_button == null or free_look_button == null:
		push_error("One or more mobile HUD controls were not created")
		quit(1)
		return
	for control in [joystick, run_button, jump_button, settings_button, free_look_button]:
		if not control.is_visible_in_tree():
			push_error("A mobile HUD control is not visible: " + control.name)
			quit(1)
			return

	var original_joystick_position := joystick.position
	world.call("_process", 0.016)
	if joystick.position.distance_to(original_joystick_position) > 0.01:
		push_error("Joystick position is being reset every frame")
		quit(1)
		return

	var move_start := joystick.global_position + joystick.size * 0.5
	var move_press := InputEventScreenTouch.new()
	move_press.index = 4
	move_press.position = move_start
	move_press.pressed = true
	world.call("_input", move_press)
	if not bool(world.get("active_move")) or int(world.get("move_touch_index")) != 4:
		push_error("Touching the joystick did not start movement")
		quit(1)
		return

	var move_drag := InputEventScreenDrag.new()
	move_drag.index = 4
	move_drag.position = move_start + Vector2(48, 0)
	move_drag.relative = Vector2(48, 0)
	world.call("_input", move_drag)
	var move_value: Vector2 = world.get("move_touch")
	if move_value.x < 0.7:
		push_error("Joystick drag did not produce movement input")
		quit(1)
		return
	var move_release := InputEventScreenTouch.new()
	move_release.index = 4
	move_release.position = move_drag.position
	move_release.pressed = false
	world.call("_input", move_release)
	if bool(world.get("active_move")):
		push_error("Releasing the joystick did not stop movement")
		quit(1)
		return

	for button in [run_button, jump_button, settings_button, free_look_button]:
		var button_touch := InputEventScreenTouch.new()
		button_touch.index = 7
		button_touch.position = button.get_global_rect().get_center()
		button_touch.pressed = true
		world.call("_input", button_touch)
		if bool(world.get("active_look")):
			push_error("Touching a HUD button was incorrectly treated as camera look: " + button.name)
			quit(1)
			return
		button_touch.pressed = false
		world.call("_input", button_touch)

	var look_start := Vector2(680, 350)
	var look_press := InputEventScreenTouch.new()
	look_press.index = 9
	look_press.position = look_start
	look_press.pressed = true
	world.call("_input", look_press)
	if not bool(world.get("active_look")):
		push_error("Touching the open right-side view did not enable camera look")
		quit(1)
		return
	var yaw_before := float(world.get("camera_yaw"))
	var look_drag := InputEventScreenDrag.new()
	look_drag.index = 9
	look_drag.position = look_start + Vector2(50, 0)
	look_drag.relative = Vector2(50, 0)
	world.call("_input", look_drag)
	if is_equal_approx(float(world.get("camera_yaw")), yaw_before):
		push_error("Camera did not rotate from right-side touch drag")
		quit(1)
		return
	var look_release := InputEventScreenTouch.new()
	look_release.index = 9
	look_release.position = look_drag.position
	look_release.pressed = false
	world.call("_input", look_release)

	world.call("_set_layout_edit_mode", true)
	var old_position: Vector2 = joystick.position
	var drag_press := InputEventScreenTouch.new()
	drag_press.index = 12
	drag_press.position = joystick.get_global_rect().get_center()
	drag_press.pressed = true
	world.call("_input", drag_press)
	if world.get("dragging_control") != joystick:
		push_error("Layout edit did not select the joystick for dragging")
		quit(1)
		return
	var layout_drag := InputEventScreenDrag.new()
	layout_drag.index = 12
	layout_drag.position = drag_press.position + Vector2(100, -40)
	layout_drag.relative = Vector2(100, -40)
	world.call("_input", layout_drag)
	var drag_release := InputEventScreenTouch.new()
	drag_release.index = 12
	drag_release.position = layout_drag.position
	drag_release.pressed = false
	world.call("_input", drag_release)
	if joystick.position.distance_to(old_position) < 20.0:
		push_error("Joystick did not move while editing the control layout")
		quit(1)
		return
	var saved_position: Vector2 = joystick.position
	world.call("_set_layout_edit_mode", false)
	joystick.position = Vector2.ZERO
	world.call("_load_control_layout")
	if joystick.position.distance_to(saved_position) > 0.1:
		push_error("Edited joystick position was not restored from saved layout")
		quit(1)
		return

	world.queue_free()
	quit(0)

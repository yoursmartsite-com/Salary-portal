extends Node3D

const FirebaseHub = preload("res://scripts/firebase_hub.gd")
const MOVE_SPEED := 5.2
const JUMP_VELOCITY := 5.8
var player: CharacterBody3D
var camera: Camera3D
var camera_yaw := 0.0
var camera_pitch := -0.22
var active_look := false
var active_move := false
var move_origin := Vector2.ZERO
var move_touch := Vector2.ZERO
var jump_requested := false
var ui_layer: CanvasLayer
var animated_legs: Array[Node3D] = []
var animated_arms: Array[Node3D] = []
var animation_clock := 0.0
var sprint_enabled := false
var attraction_wheels: Array[Node3D] = []
var status_label: Label
var run_button: Button
var jump_button: Button
var settings_panel: PanelContainer
var hud_scale := 1.0
var local_name_tag: Label3D
var firebase_bridge
var firebase_uid := ""
var firebase_send_clock := 0.0
var remote_avatars: Dictionary = {}
var remote_targets: Dictionary = {}
var remote_yaws: Dictionary = {}
var joystick_base: ColorRect
var joystick_knob: ColorRect

func _ready() -> void:
	_build_environment()
	_build_player()
	_build_camera()
	_build_hud()
	firebase_bridge = FirebaseHub.new()
	add_child(firebase_bridge)
	firebase_bridge.connected.connect(_on_firebase_connected)
	firebase_bridge.players_changed.connect(_on_firebase_players_changed)
	firebase_bridge.failed.connect(_on_firebase_failed)
	firebase_bridge.start()

func _build_environment() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	e.sky = Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.025, 0.07, 0.15)
	sky_mat.sky_horizon_color = Color(0.23, 0.31, 0.42)
	sky_mat.ground_bottom_color = Color(0.025, 0.045, 0.07)
	sky_mat.ground_horizon_color = Color(0.12, 0.17, 0.22)
	e.sky.sky_material = sky_mat
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.43, 0.55, 0.72)
	e.ambient_light_energy = 0.65
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.glow_enabled = true
	env.environment = e
	add_child(env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, -32, 0)
	sun.light_color = Color(0.72, 0.82, 1.0)
	sun.light_energy = 0.8
	sun.shadow_enabled = true
	add_child(sun)

	_make_box("Island", Vector3(0, -0.5, 0), Vector3(70, 1, 70), Color(0.12, 0.25, 0.22))
	_make_box("Main promenade", Vector3(0, 0.02, 0), Vector3(12, 0.12, 34), Color(0.43, 0.46, 0.48))
	_make_box("Central plaza", Vector3(0, 0.08, -8), Vector3(24, 0.18, 17), Color(0.57, 0.55, 0.49))
	_make_box("Beach sand", Vector3(0, -0.05, 25), Vector3(70, 0.2, 12), Color(0.72, 0.62, 0.42))
	_make_box("Ocean", Vector3(0, -0.22, 35), Vector3(180, 0.18, 180), Color(0.025, 0.24, 0.36), 0.18)

	for x in [-5.0, 5.0]:
		for z in [-20.0, -12.0, -4.0, 4.0, 12.0]:
			_make_lamp(Vector3(x, 0, z))
	for x in [-15.0, -11.0, 11.0, 15.0]:
		for z in [-20.0, -12.0, -4.0, 4.0, 12.0]:
			_make_tree(Vector3(x, 0, z))
	_make_attraction(Vector3(-15, 0, -10))
	_make_cafe(Vector3(15, 0, -12))
	_make_sign(Vector3(0, 0, -18), "LAMMA SOCIAL WORLD")

func _make_material(color: Color, roughness := 0.8, metallic := 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = roughness
	m.metallic = metallic
	return m

func _make_box(label: String, pos: Vector3, size: Vector3, color: Color, roughness := 0.85) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := MeshInstance3D.new()
	node.name = label
	node.mesh = mesh
	node.position = pos
	node.material_override = _make_material(color, roughness)
	add_child(node)
	var body := StaticBody3D.new()
	body.position = pos
	var shape_node := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = size
	shape_node.shape = box
	body.add_child(shape_node)
	add_child(body)
	return node

func _make_tree(pos: Vector3) -> void:
	var trunk := MeshInstance3D.new()
	var trunk_mesh := CylinderMesh.new()
	trunk_mesh.top_radius = 0.18
	trunk_mesh.bottom_radius = 0.28
	trunk_mesh.height = 2.3
	trunk.mesh = trunk_mesh
	trunk.position = pos + Vector3(0, 1.15, 0)
	trunk.material_override = _make_material(Color(0.25, 0.14, 0.09))
	add_child(trunk)
	var crown := MeshInstance3D.new()
	var crown_mesh := SphereMesh.new()
	crown_mesh.radius = 1.15
	crown_mesh.height = 2.2
	crown.mesh = crown_mesh
	crown.position = pos + Vector3(0, 2.8, 0)
	crown.material_override = _make_material(Color(0.08, 0.29, 0.19))
	add_child(crown)
	var body := StaticBody3D.new()
	body.position = pos + Vector3(0, 1.2, 0)
	var collision := CollisionShape3D.new()
	var shape := CylinderShape3D.new()
	shape.radius = 0.48
	shape.height = 2.4
	collision.shape = shape
	body.add_child(collision)
	add_child(body)

func _make_lamp(pos: Vector3) -> void:
	var pole := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 0.055
	pm.bottom_radius = 0.09
	pm.height = 3.5
	pole.mesh = pm
	pole.position = pos + Vector3(0, 1.75, 0)
	pole.material_override = _make_material(Color(0.12, 0.16, 0.2), 0.35, 0.7)
	add_child(pole)
	var bulb := MeshInstance3D.new()
	var bm := SphereMesh.new()
	bm.radius = 0.22
	bm.height = 0.3
	bulb.mesh = bm
	bulb.position = pos + Vector3(0, 3.5, 0)
	bulb.material_override = _make_material(Color(1.0, 0.78, 0.43), 0.2, 0.0)
	add_child(bulb)
	var light := OmniLight3D.new()
	light.position = pos + Vector3(0, 3.4, 0)
	light.light_color = Color(1.0, 0.69, 0.37)
	light.light_energy = 1.25
	light.omni_range = 8.0
	add_child(light)

func _make_attraction(pos: Vector3) -> void:
	var wheel := Node3D.new()
	wheel.name = "AnimatedFerrisWheel"
	wheel.position = pos + Vector3(0, 4.0, 0)
	add_child(wheel)
	attraction_wheels.append(wheel)
	var ring_node := MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = 2.2
	ring.outer_radius = 2.45
	ring_node.mesh = ring
	ring_node.rotation.x = deg_to_rad(90)
	ring_node.material_override = _make_material(Color(0.9, 0.38, 0.58), 0.35, 0.25)
	wheel.add_child(ring_node)
	for i in range(8):
		var angle := TAU * float(i) / 8.0
		var cabin := MeshInstance3D.new()
		var cm := BoxMesh.new()
		cm.size = Vector3(0.8, 0.9, 0.7)
		cabin.mesh = cm
		cabin.position = Vector3(cos(angle) * 2.3, sin(angle) * 2.3, 0)
		var colors := [Color("#e58d9d"), Color("#76c9c4"), Color("#e9c36c"), Color("#8d9ee6")]
		cabin.material_override = _make_material(colors[i % 4])
		wheel.add_child(cabin)
	var support := MeshInstance3D.new()
	var sm := BoxMesh.new()
	sm.size = Vector3(0.22, 8.0, 0.22)
	support.mesh = sm
	support.position = pos + Vector3(0, 4, 0)
	support.material_override = _make_material(Color(0.18, 0.23, 0.3), 0.35, 0.5)
	add_child(support)

func _make_cafe(pos: Vector3) -> void:
	_make_box("Cafe building", pos + Vector3(0, 1.7, 0), Vector3(7, 3.4, 5), Color(0.25, 0.31, 0.39))
	_make_box("Cafe roof", pos + Vector3(0, 3.55, 0), Vector3(7.6, 0.35, 5.6), Color(0.16, 0.62, 0.52))
	_make_box("Cafe window", pos + Vector3(0, 1.9, -2.56), Vector3(4.2, 1.5, 0.08), Color(0.1, 0.42, 0.55), 0.2)

func _make_sign(pos: Vector3, label: String) -> void:
	_make_box("Welcome sign", pos + Vector3(0, 2.1, 0), Vector3(8, 2.3, 0.35), Color(0.035, 0.12, 0.17))
	var text_3d := Label3D.new()
	text_3d.text = label
	text_3d.font_size = 48
	text_3d.position = pos + Vector3(0, 2.15, 0.2)
	text_3d.modulate = Color(0.55, 1.0, 0.84)
	text_3d.pixel_size = 0.008
	add_child(text_3d)

func _build_player() -> void:
	player = CharacterBody3D.new()
	player.name = "LammaGirl"
	player.position = Vector3(0, 0.1, 5)
	var capsule := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.34
	cap.height = 2.5
	capsule.shape = cap
	capsule.position.y = 1.25
	player.add_child(capsule)
	_build_girl_model(player)
	local_name_tag = Label3D.new()
	local_name_tag.name = "LocalPlayerName"
	local_name_tag.text = "لاعب"
	local_name_tag.position = Vector3(0, 2.85, 0)
	local_name_tag.font_size = 30
	local_name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	local_name_tag.modulate = Color("#e7fff7")
	player.add_child(local_name_tag)
	add_child(player)

func _part(parent: Node3D, part_name: String, mesh: Mesh, pos: Vector3, color: Color, scale := Vector3.ONE) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	part.name = part_name
	part.mesh = mesh
	part.position = pos
	part.scale = scale
	part.material_override = _make_material(color, 0.72)
	parent.add_child(part)
	return part

func _sphere(parent: Node3D, part_name: String, pos: Vector3, size: Vector3, color: Color) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = 0.5
	mesh.height = 1.0
	return _part(parent, part_name, mesh, pos, color, size)

func _build_girl_model(root: Node3D, track_local_animation := true) -> void:
	var skin := Color("#f3c6a9")
	var hair := Color("#39233b")
	var dress := Color("#7c75d8")
	var white := Color("#f7edf0")
	var body := Node3D.new()
	body.name = "StylizedGirlAvatar"
	root.add_child(body)
	_sphere(body, "Torso", Vector3(0, 1.18, 0), Vector3(0.64, 0.82, 0.36), dress)
	_sphere(body, "Neck", Vector3(0, 1.72, 0), Vector3(0.22, 0.26, 0.22), skin)
	_sphere(body, "Head", Vector3(0, 2.02, 0), Vector3(0.62, 0.72, 0.57), skin)
	_sphere(body, "Hair cap", Vector3(0, 2.29, -0.06), Vector3(0.67, 0.43, 0.62), hair)
	_sphere(body, "Hair back", Vector3(0, 1.82, -0.25), Vector3(0.62, 1.0, 0.38), hair)
	_sphere(body, "Hair left", Vector3(-0.38, 1.98, -0.02), Vector3(0.2, 0.78, 0.28), hair)
	_sphere(body, "Hair right", Vector3(0.38, 1.98, -0.02), Vector3(0.2, 0.78, 0.28), hair)
	_sphere(body, "Side fringe", Vector3(-0.22, 2.23, 0.36), Vector3(0.28, 0.24, 0.2), hair)
	_sphere(body, "Eye left", Vector3(-0.16, 2.08, 0.48), Vector3(0.075, 0.105, 0.045), Color("#38243b"))
	_sphere(body, "Eye right", Vector3(0.16, 2.08, 0.48), Vector3(0.075, 0.105, 0.045), Color("#38243b"))
	_sphere(body, "Eye shine left", Vector3(-0.18, 2.12, 0.52), Vector3(0.025, 0.03, 0.018), white)
	_sphere(body, "Eye shine right", Vector3(0.14, 2.12, 0.52), Vector3(0.025, 0.03, 0.018), white)
	_sphere(body, "Blush left", Vector3(-0.27, 1.96, 0.43), Vector3(0.11, 0.055, 0.025), Color("#e99a9b"))
	_sphere(body, "Blush right", Vector3(0.27, 1.96, 0.43), Vector3(0.11, 0.055, 0.025), Color("#e99a9b"))
	_sphere(body, "Smile", Vector3(0, 1.91, 0.49), Vector3(0.09, 0.035, 0.025), Color("#b65d6e"))
	_sphere(body, "Skirt", Vector3(0, 0.77, 0), Vector3(0.76, 0.56, 0.48), Color("#a9a1ec"))
	var ponytail := _sphere(body, "Long ponytail", Vector3(0, 1.72, -0.48), Vector3(0.3, 0.85, 0.32), hair)
	ponytail.rotation.x = -0.22
	for side in [-1.0, 1.0]:
		var arm_pivot := Node3D.new()
		arm_pivot.name = "ArmPivot"
		arm_pivot.position = Vector3(side * 0.43, 1.48, 0)
		body.add_child(arm_pivot)
		_sphere(arm_pivot, "Upper arm", Vector3(0, -0.25, 0), Vector3(0.23, 0.58, 0.24), dress)
		_sphere(arm_pivot, "Hand", Vector3(0, -0.55, 0.02), Vector3(0.2, 0.22, 0.2), skin)
		if track_local_animation:
			animated_arms.append(arm_pivot)
		var leg_pivot := Node3D.new()
		leg_pivot.name = "LegPivot"
		leg_pivot.position = Vector3(side * 0.2, 0.57, 0)
		body.add_child(leg_pivot)
		_sphere(leg_pivot, "Leg", Vector3(0, -0.25, 0), Vector3(0.23, 0.62, 0.24), skin)
		_sphere(leg_pivot, "Shoe", Vector3(0, -0.54, 0.09), Vector3(0.3, 0.16, 0.43), white)
		if track_local_animation:
			animated_legs.append(leg_pivot)

func _build_camera() -> void:
	camera = Camera3D.new()
	camera.name = "FollowCamera"
	camera.current = true
	camera.fov = 62
	add_child(camera)
	_update_camera()

func _update_camera(delta := 1.0) -> void:
	if not is_instance_valid(player):
		return
	var target := player.global_position + Vector3(0, 1.55, 0)
	var offset := Vector3(sin(camera_yaw) * 7.0, 3.2 - camera_pitch * 2.0, cos(camera_yaw) * 7.0)
	camera.global_position = camera.global_position.lerp(target + offset, 1.0 - exp(-8.0 * delta))
	camera.look_at(target, Vector3.UP)

func _build_hud() -> void:
	ui_layer = CanvasLayer.new()
	add_child(ui_layer)
	var title := Label.new()
	title.text = "لَمّة  |  عالم الأصدقاء"
	title.position = Vector2(24, 18)
	title.add_theme_font_size_override("font_size", 25)
	title.add_theme_color_override("font_color", Color("#e7fff7"))
	ui_layer.add_child(title)
	status_label = Label.new()
	status_label.text = "جاري الاتصال بعالم لَمّة..."
	status_label.position = Vector2(26, 54)
	status_label.add_theme_font_size_override("font_size", 14)
	status_label.add_theme_color_override("font_color", Color("#b9d8dc"))
	ui_layer.add_child(status_label)
	run_button = Button.new()
	run_button.text = "جري"
	run_button.custom_minimum_size = Vector2(90, 54)
	run_button.anchor_left = 1
	run_button.anchor_right = 1
	run_button.anchor_top = 1
	run_button.anchor_bottom = 1
	run_button.position = Vector2(-116, -178)
	run_button.pivot_offset = Vector2(45, 27)
	run_button.toggle_mode = true
	run_button.toggled.connect(func(enabled: bool): sprint_enabled = enabled)
	ui_layer.add_child(run_button)
	jump_button = Button.new()
	jump_button.text = "قفز"
	jump_button.custom_minimum_size = Vector2(90, 62)
	jump_button.anchor_left = 1
	jump_button.anchor_right = 1
	jump_button.anchor_top = 1
	jump_button.anchor_bottom = 1
	jump_button.position = Vector2(-116, -105)
	jump_button.pivot_offset = Vector2(45, 31)
	jump_button.pressed.connect(func(): jump_requested = true)
	ui_layer.add_child(jump_button)
	joystick_base = ColorRect.new()
	joystick_base.name = "TouchJoystickBase"
	joystick_base.color = Color(0.04, 0.08, 0.13, 0.48)
	joystick_base.size = Vector2(142, 142)
	joystick_base.position = Vector2(28, get_viewport().get_visible_rect().size.y - 174)
	joystick_base.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui_layer.add_child(joystick_base)
	joystick_knob = ColorRect.new()
	joystick_knob.name = "TouchJoystickKnob"
	joystick_knob.color = Color(0.45, 0.9, 0.78, 0.78)
	joystick_knob.size = Vector2(58, 58)
	joystick_knob.position = Vector2(42, 42)
	joystick_knob.mouse_filter = Control.MOUSE_FILTER_IGNORE
	joystick_base.add_child(joystick_knob)

	var settings_button := Button.new()
	settings_button.text = "إعدادات"
	settings_button.custom_minimum_size = Vector2(116, 46)
	settings_button.anchor_left = 1
	settings_button.anchor_right = 1
	settings_button.position = Vector2(-138, 18)
	settings_button.pressed.connect(_toggle_settings)
	ui_layer.add_child(settings_button)
	settings_panel = PanelContainer.new()
	settings_panel.name = "ControlSettings"
	settings_panel.anchor_left = 1
	settings_panel.anchor_right = 1
	settings_panel.position = Vector2(-292, 72)
	settings_panel.custom_minimum_size = Vector2(270, 150)
	settings_panel.visible = false
	ui_layer.add_child(settings_panel)
	var settings_content := VBoxContainer.new()
	settings_content.add_theme_constant_override("separation", 10)
	settings_panel.add_child(settings_content)
	var settings_title := Label.new()
	settings_title.text = "إعدادات التحكم"
	settings_title.add_theme_font_size_override("font_size", 17)
	settings_content.add_child(settings_title)
	var scale_label := Label.new()
	scale_label.text = "حجم أزرار الحركة والقفز"
	settings_content.add_child(scale_label)
	var scale_slider := HSlider.new()
	scale_slider.min_value = 0.7
	scale_slider.max_value = 1.4
	scale_slider.step = 0.05
	scale_slider.value = 1.0
	scale_slider.custom_minimum_size = Vector2(230, 30)
	scale_slider.value_changed.connect(_on_hud_scale_changed)
	settings_content.add_child(scale_slider)
	var close_settings := Button.new()
	close_settings.text = "إغلاق"
	close_settings.pressed.connect(func(): settings_panel.visible = false)
	settings_content.add_child(close_settings)
	var hint := Label.new()
	hint.text = "حرّك العصا يسارًا · اسحب يمينًا لتحريك الكاميرا"
	hint.anchor_left = 0.5
	hint.anchor_right = 0.5
	hint.anchor_top = 1
	hint.anchor_bottom = 1
	hint.position = Vector2(-130, -36)
	hint.add_theme_font_size_override("font_size", 12)
	ui_layer.add_child(hint)

func _toggle_settings() -> void:
	if is_instance_valid(settings_panel):
		settings_panel.visible = not settings_panel.visible

func _on_hud_scale_changed(value: float) -> void:
	hud_scale = value
	if is_instance_valid(joystick_base):
		joystick_base.pivot_offset = Vector2(71, 71)
		joystick_base.scale = Vector2.ONE * hud_scale
	if is_instance_valid(run_button):
		run_button.scale = Vector2.ONE * hud_scale
	if is_instance_valid(jump_button):
		jump_button.scale = Vector2.ONE * hud_scale

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		camera_yaw -= event.relative.x * 0.006
		camera_pitch = clampf(camera_pitch + event.relative.y * 0.004, -0.65, 0.25)
	elif event is InputEventScreenTouch:
		if event.pressed:
			if event.position.x < get_viewport().size.x * 0.42:
				active_move = true
				move_origin = event.position
				move_touch = Vector2.ZERO
				_update_joystick_visual()
			elif event.position.x > get_viewport().size.x * 0.55:
				active_look = true
		else:
			if event.position.x < get_viewport().size.x * 0.48:
				active_move = false
				move_touch = Vector2.ZERO
				_update_joystick_visual()
			else:
				active_look = false
	elif event is InputEventScreenDrag:
		if active_move:
			move_touch = ((event.position - move_origin) / 65.0).limit_length(1.0)
			_update_joystick_visual()
		elif active_look:
			camera_yaw -= event.relative.x * 0.006
			camera_pitch = clampf(camera_pitch + event.relative.y * 0.004, -0.65, 0.25)

func _update_joystick_visual() -> void:
	if not is_instance_valid(joystick_knob):
		return
	var offset := move_touch * 38.0
	joystick_knob.position = Vector2(42, 42) + offset

func _process(delta: float) -> void:
	for wheel in attraction_wheels:
		wheel.rotation.z += delta * 0.22
	_update_camera(delta)
	_update_remote_players(delta)
	if firebase_uid != "" and is_instance_valid(player):
		firebase_send_clock += delta
		if firebase_send_clock >= 0.2:
			firebase_send_clock = 0.0
			firebase_bridge.send_position(player.global_position, player.rotation.y)
	if is_instance_valid(joystick_base):
		joystick_base.position.y = get_viewport().get_visible_rect().size.y - 174.0
	if not is_instance_valid(player):
		return
	var horizontal_speed := Vector2(player.velocity.x, player.velocity.z).length()
	if horizontal_speed > 0.25 and player.is_on_floor():
		animation_clock += delta * 9.0
		var swing := sin(animation_clock) * 0.42
		for i in range(animated_legs.size()):
			animated_legs[i].rotation.x = swing if i == 0 else -swing
		for i in range(animated_arms.size()):
			animated_arms[i].rotation.x = -swing if i == 0 else swing
	else:
		for limb in animated_legs:
			limb.rotation.x = move_toward(limb.rotation.x, 0.0, delta * 3.5)
		for limb in animated_arms:
			limb.rotation.x = move_toward(limb.rotation.x, 0.0, delta * 3.5)


func _on_firebase_connected(uid: String, player_name: String) -> void:
	firebase_uid = uid
	if is_instance_valid(local_name_tag):
		local_name_tag.text = player_name
	if is_instance_valid(status_label):
		status_label.text = "متصل أونلاين · جاري البحث عن اللاعبين..."

func _on_firebase_failed(reason: String) -> void:
	if is_instance_valid(status_label):
		status_label.text = "تعذر الاتصال: " + reason

func _on_firebase_players_changed(data: Dictionary) -> void:
	var seen: Dictionary = {}
	var now_ms := Time.get_unix_time_from_system() * 1000.0
	for room_id in data:
		var room = data[room_id]
		if typeof(room) != TYPE_DICTIONARY:
			continue
		var game = room.get("game", {})
		if typeof(game) != TYPE_DICTIONARY or game.get("type", "") != "lamma_hub":
			continue
		var players = room.get("players", {})
		if typeof(players) != TYPE_DICTIONARY:
			continue
		for uid in players:
			if str(uid) == firebase_uid:
				continue
			var entry = players[uid]
			if typeof(entry) != TYPE_DICTIONARY:
				continue
			if now_ms - float(entry.get("updatedAt", 0)) > 12000.0:
				continue
			var pos = entry.get("position", {})
			if typeof(pos) != TYPE_DICTIONARY:
				continue
			seen[str(uid)] = true
			if not remote_avatars.has(str(uid)):
				_create_remote_avatar(str(uid), str(entry.get("name", "لاعب")))
			remote_targets[str(uid)] = Vector3(
				float(pos.get("x", 0.0)),
				float(pos.get("y", 0.0)),
				float(pos.get("z", 0.0))
			)
			remote_yaws[str(uid)] = float(entry.get("yaw", 0.0))
	for uid in remote_avatars.keys():
		if not seen.has(uid):
			remote_avatars[uid].queue_free()
			remote_avatars.erase(uid)
			remote_targets.erase(uid)
			remote_yaws.erase(uid)
	if is_instance_valid(status_label) and firebase_uid != "":
		status_label.text = "متصل أونلاين · " + str(remote_avatars.size() + 1) + " لاعب"

func _create_remote_avatar(uid: String, player_name: String) -> void:
	var remote := Node3D.new()
	remote.name = "RemotePlayer_" + uid
	add_child(remote)
	var collider_body := StaticBody3D.new()
	collider_body.name = "PlayerCollision"
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.34
	capsule.height = 2.5
	collision.shape = capsule
	collision.position.y = 1.25
	collider_body.add_child(collision)
	remote.add_child(collider_body)
	_build_girl_model(remote, false)
	var name_tag := Label3D.new()
	name_tag.name = "PlayerName"
	name_tag.text = player_name
	name_tag.position = Vector3(0, 2.85, 0)
	name_tag.font_size = 30
	name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	name_tag.modulate = Color("#e7fff7")
	remote.add_child(name_tag)
	remote_avatars[uid] = remote

func _update_remote_players(delta: float) -> void:
	for uid in remote_avatars:
		var remote: Node3D = remote_avatars[uid]
		if remote_targets.has(uid):
			remote.global_position = remote.global_position.lerp(remote_targets[uid], minf(1.0, delta * 8.0))
			remote.rotation.y = lerp_angle(remote.rotation.y, float(remote_yaws.get(uid, 0.0)), delta * 8.0)

func _physics_process(delta: float) -> void:
	if not is_instance_valid(player):
		return
	var input_dir := move_touch if active_move else Vector2(
		Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"),
		Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up")
	)
	if input_dir.length() > 1.0:
		input_dir = input_dir.normalized()
	var forward := Vector3(sin(camera_yaw), 0, cos(camera_yaw))
	var right := Vector3(forward.z, 0, -forward.x)
	var direction := (right * input_dir.x + forward * input_dir.y).normalized()
	if direction.length() > 0.05:
		var current_speed := MOVE_SPEED * (1.65 if sprint_enabled else 1.0)
		player.velocity.x = direction.x * current_speed
		player.velocity.z = direction.z * current_speed
		player.rotation.y = lerp_angle(player.rotation.y, atan2(direction.x, direction.z), delta * 9.0)
	else:
		player.velocity.x = move_toward(player.velocity.x, 0, MOVE_SPEED * delta * 3.0)
		player.velocity.z = move_toward(player.velocity.z, 0, MOVE_SPEED * delta * 3.0)
	if not player.is_on_floor():
		player.velocity.y -= 18.0 * delta
	elif jump_requested or Input.is_action_just_pressed("ui_accept"):
		player.velocity.y = JUMP_VELOCITY
	jump_requested = false
	player.move_and_slide()

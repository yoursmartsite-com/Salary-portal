extends CharacterBody3D

var game
var camera_pivot: Node3D
var camera: Camera3D
var ammo := 30
var reserve := 90
var health := 100
var speed := 7.0
var gravity := 22.0
var look_sensitivity := 0.003
var yaw := 0.0
var pitch := -0.12
var move_touch := -1
var look_touch := -1
var move_origin := Vector2.ZERO
var move_vector := Vector2.ZERO
var last_look := Vector2.ZERO
var fire_cooldown := 0.0
var reloading := false
var visual_root: Node3D
var left_leg: Node3D
var right_leg: Node3D
var left_arm: Node3D
var right_arm: Node3D
var walk_time := 0.0
var muzzle: MeshInstance3D

func setup(owner_game) -> void:
	game = owner_game
	_build_character()
	_build_camera()
	set_process_input(true)

func _mat(color: Color, metal := 0.0, rough := 0.8) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.metallic = metal
	m.roughness = rough
	return m

func _part(parent: Node3D, mesh: Mesh, pos: Vector3, material: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.position = pos
	node.rotation_degrees = rot
	node.material_override = material
	parent.add_child(node)
	return node

func _box(size: Vector3) -> BoxMesh:
	var m := BoxMesh.new()
	m.size = size
	return m

func _sphere(radius: float, height: float) -> SphereMesh:
	var m := SphereMesh.new()
	m.radius = radius
	m.height = height
	return m

func _build_character() -> void:
	visual_root = Node3D.new()
	add_child(visual_root)
	var cloth := _mat(Color(0.20,0.27,0.22))
	var dark := _mat(Color(0.075,0.095,0.085),0.18)
	var armor := _mat(Color(0.29,0.34,0.28),0.12)
	var skin := _mat(Color(0.66,0.46,0.33))
	var metal := _mat(Color(0.045,0.055,0.052),0.55,0.38)
	# torso, tactical vest and equipment
	_part(visual_root, _box(Vector3(0.78,0.82,0.40)), Vector3(0,1.22,0), cloth)
	_part(visual_root, _box(Vector3(0.66,0.62,0.16)), Vector3(0,1.25,-0.245), armor)
	_part(visual_root, _box(Vector3(0.18,0.25,0.19)), Vector3(-0.20,1.04,-0.34), dark)
	_part(visual_root, _box(Vector3(0.18,0.25,0.19)), Vector3(0.20,1.04,-0.34), dark)
	_part(visual_root, _box(Vector3(0.50,0.13,0.43)), Vector3(0,0.78,0), dark)
	# neck and head
	_part(visual_root, _sphere(0.14,0.25), Vector3(0,1.72,0), skin)
	_part(visual_root, _sphere(0.235,0.43), Vector3(0,1.94,0), skin)
	_part(visual_root, _sphere(0.255,0.25), Vector3(0,2.10,0), armor)
	_part(visual_root, _box(Vector3(0.55,0.10,0.34)), Vector3(0,2.00,-0.02), dark)
	_part(visual_root, _box(Vector3(0.19,0.09,0.08)), Vector3(-0.12,2.01,-0.205), metal)
	_part(visual_root, _box(Vector3(0.19,0.09,0.08)), Vector3(0.12,2.01,-0.205), metal)
	# backpack
	_part(visual_root, _box(Vector3(0.48,0.60,0.22)), Vector3(0,1.30,0.31), dark)
	_part(visual_root, _box(Vector3(0.30,0.18,0.25)), Vector3(0,1.10,0.44), armor)
	# articulated arms
	left_arm = Node3D.new()
	left_arm.position = Vector3(-0.48,1.52,0)
	visual_root.add_child(left_arm)
	_part(left_arm,_sphere(0.19,0.40),Vector3(0,-0.17,0),cloth,Vector3(0,0,12))
	_part(left_arm,_sphere(0.14,0.38),Vector3(0,-0.48,-0.10),armor)
	_part(left_arm,_sphere(0.13,0.18),Vector3(0,-0.68,-0.16),dark)
	right_arm = Node3D.new()
	right_arm.position = Vector3(0.48,1.52,0)
	visual_root.add_child(right_arm)
	_part(right_arm,_sphere(0.19,0.40),Vector3(0,-0.17,0),cloth,Vector3(0,0,-12))
	_part(right_arm,_sphere(0.14,0.38),Vector3(0,-0.48,-0.10),armor)
	_part(right_arm,_sphere(0.13,0.18),Vector3(0,-0.68,-0.16),dark)
	# articulated legs and boots
	left_leg = Node3D.new()
	left_leg.position = Vector3(-0.22,0.78,0)
	visual_root.add_child(left_leg)
	_part(left_leg,_sphere(0.19,0.55),Vector3(0,-0.24,0),cloth)
	_part(left_leg,_sphere(0.15,0.40),Vector3(0,-0.58,-0.015),armor)
	_part(left_leg,_box(Vector3(0.27,0.16,0.42)),Vector3(0,-0.78,-0.09),dark)
	right_leg = Node3D.new()
	right_leg.position = Vector3(0.22,0.78,0)
	visual_root.add_child(right_leg)
	_part(right_leg,_sphere(0.19,0.55),Vector3(0,-0.24,0),cloth)
	_part(right_leg,_sphere(0.15,0.40),Vector3(0,-0.58,-0.015),armor)
	_part(right_leg,_box(Vector3(0.27,0.16,0.42)),Vector3(0,-0.78,-0.09),dark)
	# detailed rifle held across the chest
	var rifle := Node3D.new()
	rifle.position = Vector3(0.36,1.28,-0.43)
	rifle.rotation_degrees = Vector3(0,0,-5)
	visual_root.add_child(rifle)
	_part(rifle,_box(Vector3(0.13,0.13,0.82)),Vector3(0,0,-0.18),metal)
	_part(rifle,_box(Vector3(0.17,0.18,0.28)),Vector3(0,0.02,0.08),dark)
	_part(rifle,_box(Vector3(0.12,0.25,0.16)),Vector3(0,-0.16,0.14),dark,Vector3(-15,0,0))
	_part(rifle,_box(Vector3(0.055,0.055,0.42)),Vector3(0,0.10,-0.62),metal)
	_part(rifle,_box(Vector3(0.20,0.07,0.20)),Vector3(0,0.10,-0.48),dark)
	muzzle = _part(rifle,_sphere(0.055,0.08),Vector3(0,0,-0.86),_mat(Color(1.0,0.48,0.12),0.0,0.3))
	muzzle.visible = false
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.38
	shape.height = 2.0
	col.shape = shape
	col.position.y = 1.0
	add_child(col)

func _build_camera() -> void:
	camera_pivot = Node3D.new()
	camera_pivot.position = Vector3(0,1.65,0)
	add_child(camera_pivot)
	camera = Camera3D.new()
	camera.position = Vector3(0,0.9,5.2)
	camera.rotation_degrees.x = -8
	camera.current = true
	camera.fov = 68
	camera_pivot.add_child(camera)

func _physics_process(delta: float) -> void:
	fire_cooldown = maxf(0.0, fire_cooldown - delta)
	var input_vec := move_vector
	if input_vec.length() < 0.05:
		input_vec = Input.get_vector("move_left","move_right","move_forward","move_back")
	var dir := (transform.basis * Vector3(input_vec.x,0,input_vec.y)).normalized()
	velocity.x = dir.x * speed
	velocity.z = dir.z * speed
	if not is_on_floor():
		velocity.y -= gravity * delta
	elif velocity.y < 0:
		velocity.y = 0
	move_and_slide()
	rotation.y = yaw
	camera_pivot.rotation.x = pitch
	if Input.is_action_just_pressed("jump"):
		jump_now()
	if dir.length() > 0.1 and is_on_floor():
		walk_time += delta * 9.0
		left_leg.rotation.x = sin(walk_time) * 0.48
		right_leg.rotation.x = -sin(walk_time) * 0.48
		left_arm.rotation.x = -sin(walk_time) * 0.20
	else:
		left_leg.rotation.x = lerpf(left_leg.rotation.x,0.0,delta*8.0)
		right_leg.rotation.x = lerpf(right_leg.rotation.x,0.0,delta*8.0)
		left_arm.rotation.x = lerpf(left_arm.rotation.x,0.0,delta*8.0)

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var size := get_viewport().get_visible_rect().size
		if event.pressed:
			if event.position.x < size.x * 0.48 and move_touch == -1:
				move_touch = event.index
				move_origin = event.position
				move_vector = Vector2.ZERO
			elif event.position.x >= size.x * 0.48 and look_touch == -1:
				look_touch = event.index
				last_look = event.position
		else:
			if event.index == move_touch:
				move_touch = -1
				move_vector = Vector2.ZERO
			if event.index == look_touch:
				look_touch = -1
	elif event is InputEventScreenDrag:
		if event.index == move_touch:
			move_vector = ((event.position - move_origin) / 85.0).limit_length(1.0)
		elif event.index == look_touch:
			var diff: Vector2 = event.position - last_look
			yaw -= diff.x * look_sensitivity
			pitch = clampf(pitch - diff.y * look_sensitivity, -0.75, 0.35)
			last_look = event.position
	elif event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		yaw -= event.relative.x * 0.004
		pitch = clampf(pitch - event.relative.y * 0.004, -0.75, 0.35)

func jump_now() -> void:
	if is_on_floor():
		velocity.y = 8.5

func fire() -> void:
	if fire_cooldown > 0.0 or reloading or ammo <= 0:
		return
	ammo -= 1
	fire_cooldown = 0.16
	if muzzle:
		muzzle.visible = true
		await get_tree().create_timer(0.055).timeout
		if is_instance_valid(muzzle):
			muzzle.visible = false
	var from := camera.global_position
	var to := from + -camera.global_transform.basis.z * 180.0
	var query := PhysicsRayQueryParameters3D.create(from, to)
	query.exclude = [get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(query)
	if hit and hit.collider.has_method("take_damage"):
		hit.collider.take_damage(34)

func reload() -> void:
	if reloading or ammo == 30 or reserve <= 0:
		return
	reloading = true
	await get_tree().create_timer(1.6).timeout
	var amount := mini(30 - ammo, reserve)
	ammo += amount
	reserve -= amount
	reloading = false

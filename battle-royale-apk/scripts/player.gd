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

func setup(owner_game) -> void:
	game = owner_game
	_build_character()
	_build_camera()
	set_process_input(true)

func _build_character() -> void:
	var capsule := CapsuleMesh.new()
	capsule.radius = 0.42
	capsule.height = 1.65
	var torso := MeshInstance3D.new()
	torso.mesh = capsule
	torso.position.y = 0.95
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.19,0.24,0.22)
	mat.metallic = 0.05
	torso.material_override = mat
	add_child(torso)
	var head := MeshInstance3D.new()
	var hm := SphereMesh.new()
	hm.radius = 0.24
	hm.height = 0.48
	head.mesh = hm
	head.position.y = 2.0
	var skin := StandardMaterial3D.new()
	skin.albedo_color = Color(0.72,0.55,0.42)
	head.material_override = skin
	add_child(head)
	var helmet := MeshInstance3D.new()
	var hmesh := SphereMesh.new()
	hmesh.radius = 0.27
	hmesh.height = 0.28
	helmet.mesh = hmesh
	helmet.position = Vector3(0,2.13,0)
	var hmatt := StandardMaterial3D.new()
	hmatt.albedo_color = Color(0.17,0.21,0.19)
	helmet.material_override = hmatt
	add_child(helmet)
	var gun := MeshInstance3D.new()
	var gm := BoxMesh.new()
	gm.size = Vector3(0.12,0.13,0.9)
	gun.mesh = gm
	gun.position = Vector3(0.38,1.38,-0.48)
	var gmat := StandardMaterial3D.new()
	gmat.albedo_color = Color(0.07,0.08,0.075)
	gun.material_override = gmat
	add_child(gun)
	var col := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.42
	shape.height = 2.1
	col.shape = shape
	add_child(col)

func _build_camera() -> void:
	camera_pivot = Node3D.new()
	camera_pivot.position = Vector3(0,1.65,0)
	add_child(camera_pivot)
	camera = Camera3D.new()
	camera.position = Vector3(0,1.0,5.8)
	camera.rotation_degrees.x = -8
	camera.current = true
	camera.fov = 72
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
			move_vector = (event.position - move_origin) / 85.0
			move_vector = move_vector.limit_length(1.0)
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
	if fire_cooldown > 0 or reloading or ammo <= 0:
		return
	ammo -= 1
	fire_cooldown = 0.16
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

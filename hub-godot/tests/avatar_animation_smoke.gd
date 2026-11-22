extends SceneTree

func _initialize() -> void:
	call_deferred("_run")

func _run() -> void:
	var path := "res://assets/lamma_girl.glb"
	if not ResourceLoader.exists(path):
		push_error("Avatar GLB is missing: " + path)
		quit(1)
		return
	var packed := load(path) as PackedScene
	if packed == null:
		push_error("Avatar GLB did not import as PackedScene")
		quit(1)
		return
	var model := packed.instantiate()
	root.add_child(model)
	var players := model.find_children("*", "AnimationPlayer", true, false)
	if players.is_empty():
		push_error("Avatar has no AnimationPlayer")
		quit(1)
		return
	var found_walk := false
	var found_run := false
	for node in players:
		var ap := node as AnimationPlayer
		var names := ap.get_animation_list()
		print("AVATAR_ANIMATION_PLAYER=", ap.get_path(), " CLIPS=", names)
		for name in names:
			var clip := ap.get_animation(name)
			print("AVATAR_CLIP name=", name, " length=", clip.length, " tracks=", clip.get_track_count(), " loop=", clip.loop_mode)
			var lowered := name.to_lower()
			if lowered.contains("walk"):
				found_walk = true
				if clip.length < 0.5 or clip.get_track_count() < 4:
					push_error("Walk clip is too short or has too few tracks: " + name)
					quit(1)
					return
				clip.loop_mode = Animation.LOOP_LINEAR
				if clip.loop_mode != Animation.LOOP_LINEAR:
					push_error("Walk clip failed to enter LOOP_LINEAR")
					quit(1)
					return
			if lowered.contains("run"):
				found_run = true
				if clip.length < 0.5 or clip.get_track_count() < 4:
					push_error("Run clip is too short or has too few tracks: " + name)
					quit(1)
					return
				clip.loop_mode = Animation.LOOP_LINEAR
				if clip.loop_mode != Animation.LOOP_LINEAR:
					push_error("Run clip failed to enter LOOP_LINEAR")
					quit(1)
					return
	if not found_walk:
		push_error("No animation name containing 'walk' was imported")
		quit(1)
		return
	if not found_run:
		push_error("No animation name containing 'run' was imported")
		quit(1)
		return
	print("AVATAR_ANIMATION_VALIDATION_OK walk=", found_walk, " run=", found_run)
	model.queue_free()
	quit(0)

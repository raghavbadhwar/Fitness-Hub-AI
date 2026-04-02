export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroup: string;
  equipment: string;
  description: string;
  defaultSets: number;
  defaultReps: string;
  defaultRestSeconds: number;
}

export const EXERCISES: Exercise[] = [
  // Chest (10)
  { id: "bench_press", name: "Bench Press", category: "Strength", muscleGroup: "Chest", equipment: "Barbell", description: "Lie on bench, lower bar to chest, press up", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "incline_press", name: "Incline Bench Press", category: "Strength", muscleGroup: "Chest", equipment: "Barbell", description: "Incline bench at 30-45°, press barbell", defaultSets: 3, defaultReps: "8-12", defaultRestSeconds: 90 },
  { id: "decline_press", name: "Decline Bench Press", category: "Strength", muscleGroup: "Chest", equipment: "Barbell", description: "Decline bench, lower bar to lower chest", defaultSets: 3, defaultReps: "8-12", defaultRestSeconds: 90 },
  { id: "dumbbell_fly", name: "Dumbbell Fly", category: "Strength", muscleGroup: "Chest", equipment: "Dumbbell", description: "Lie on bench, arc dumbbells from sides to top", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "pushup", name: "Push Up", category: "Bodyweight", muscleGroup: "Chest", equipment: "None", description: "Classic push up with full range of motion", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 60 },
  { id: "cable_crossover", name: "Cable Crossover", category: "Strength", muscleGroup: "Chest", equipment: "Cable", description: "Pull cables from high to low across body", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "incline_dumbbell_press", name: "Incline Dumbbell Press", category: "Strength", muscleGroup: "Chest", equipment: "Dumbbell", description: "Incline bench, press dumbbells up from chest", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "chest_dips", name: "Chest Dips", category: "Bodyweight", muscleGroup: "Chest", equipment: "None", description: "Lean forward on dip bars to target chest", defaultSets: 3, defaultReps: "10-15", defaultRestSeconds: 75 },
  { id: "pec_deck", name: "Pec Deck Machine", category: "Strength", muscleGroup: "Chest", equipment: "Machine", description: "Sit at machine, bring arms together in front", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "pushup_wide", name: "Wide Push Up", category: "Bodyweight", muscleGroup: "Chest", equipment: "None", description: "Push up with hands wider than shoulder width", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 60 },

  // Legs (12)
  { id: "squat", name: "Back Squat", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Bar on traps, squat to parallel depth", defaultSets: 4, defaultReps: "6-8", defaultRestSeconds: 120 },
  { id: "front_squat", name: "Front Squat", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Bar on front rack, squat keeping torso upright", defaultSets: 3, defaultReps: "6-8", defaultRestSeconds: 120 },
  { id: "leg_press", name: "Leg Press", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Press platform away, feet shoulder-width", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 90 },
  { id: "lunges", name: "Lunges", category: "Strength", muscleGroup: "Legs", equipment: "Dumbbell", description: "Step forward, lower back knee to floor", defaultSets: 3, defaultReps: "12 each", defaultRestSeconds: 60 },
  { id: "split_squat", name: "Bulgarian Split Squat", category: "Strength", muscleGroup: "Legs", equipment: "Dumbbell", description: "Rear foot elevated, lunge down with dumbbells", defaultSets: 3, defaultReps: "10 each", defaultRestSeconds: 90 },
  { id: "leg_curl", name: "Hamstring Curl", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Curl legs up on lying curl machine", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "leg_extension", name: "Leg Extension", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Extend legs fully on machine, squeeze quads", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "calf_raise", name: "Calf Raise", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Raise on toes, full range of motion", defaultSets: 4, defaultReps: "15-20", defaultRestSeconds: 45 },
  { id: "deadlift", name: "Deadlift", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Hinge at hips, keep back straight, lift bar", defaultSets: 4, defaultReps: "5-6", defaultRestSeconds: 120 },
  { id: "rdl", name: "Romanian Deadlift", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Hinge at hips with slight knee bend", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "goblet_squat", name: "Goblet Squat", category: "Strength", muscleGroup: "Legs", equipment: "Dumbbell", description: "Hold dumbbell at chest, squat deep", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "hip_thrust", name: "Hip Thrust", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Upper back on bench, drive hips up with barbell", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },

  // Back (10)
  { id: "pullup", name: "Pull Up", category: "Bodyweight", muscleGroup: "Back", equipment: "None", description: "Dead hang, pull until chin clears bar", defaultSets: 3, defaultReps: "6-10", defaultRestSeconds: 90 },
  { id: "chinup", name: "Chin Up", category: "Bodyweight", muscleGroup: "Back", equipment: "None", description: "Underhand grip, pull until chin clears bar", defaultSets: 3, defaultReps: "6-10", defaultRestSeconds: 90 },
  { id: "lat_pulldown", name: "Lat Pulldown", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Pull bar to upper chest, squeeze lats", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "bent_row", name: "Bent Over Row", category: "Strength", muscleGroup: "Back", equipment: "Barbell", description: "Hinge forward, pull bar to lower chest", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "seated_row", name: "Seated Cable Row", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Pull handle to abdomen, squeeze shoulder blades", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "single_arm_row", name: "Single Arm Dumbbell Row", category: "Strength", muscleGroup: "Back", equipment: "Dumbbell", description: "Knee on bench, row dumbbell to hip", defaultSets: 3, defaultReps: "10-12 each", defaultRestSeconds: 60 },
  { id: "t_bar_row", name: "T-Bar Row", category: "Strength", muscleGroup: "Back", equipment: "Barbell", description: "Straddle bar, row to chest with neutral grip", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "face_pull", name: "Face Pull", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Pull rope to face level, elbows high", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 60 },
  { id: "straight_arm_pulldown", name: "Straight Arm Pulldown", category: "Strength", muscleGroup: "Back", equipment: "Cable", description: "Arms straight, pull bar from overhead to hips", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "hyperextension", name: "Back Extension / Hyperextension", category: "Strength", muscleGroup: "Back", equipment: "Machine", description: "Hinge at waist on machine, extend back up", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 45 },

  // Shoulders (8)
  { id: "overhead_press", name: "Overhead Press", category: "Strength", muscleGroup: "Shoulders", equipment: "Barbell", description: "Press barbell overhead from front rack", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "shoulder_press", name: "Dumbbell Shoulder Press", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Press dumbbells overhead from ear height", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "lateral_raise", name: "Lateral Raise", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Raise dumbbells to sides to shoulder height", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "front_raise", name: "Front Raise", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Raise dumbbells to shoulder height in front", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "cable_lateral_raise", name: "Cable Lateral Raise", category: "Strength", muscleGroup: "Shoulders", equipment: "Cable", description: "Cable at low pulley, raise arm to side", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "arnold_press", name: "Arnold Press", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Start palms in, rotate and press up", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "upright_row", name: "Upright Row", category: "Strength", muscleGroup: "Shoulders", equipment: "Barbell", description: "Pull bar to chin level, elbows out", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "reverse_fly", name: "Reverse Fly", category: "Strength", muscleGroup: "Shoulders", equipment: "Dumbbell", description: "Bent over, raise dumbbells out to sides", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },

  // Biceps (6)
  { id: "bicep_curl", name: "Bicep Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Curl dumbbells alternately, supinate at top", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "hammer_curl", name: "Hammer Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Neutral grip curl for biceps and brachialis", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "barbell_curl", name: "Barbell Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Barbell", description: "Underhand grip, curl bar to chest", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 75 },
  { id: "preacher_curl", name: "Preacher Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Machine", description: "Arm rests on pad, full range curl", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "cable_curl", name: "Cable Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Cable", description: "Curl cable bar/rope for constant tension", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "concentration_curl", name: "Concentration Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Seated, elbow on inner thigh, curl dumbbell", defaultSets: 3, defaultReps: "10-12 each", defaultRestSeconds: 45 },

  // Triceps (7)
  { id: "tricep_pushdown", name: "Tricep Pushdown", category: "Strength", muscleGroup: "Triceps", equipment: "Cable", description: "Push rope/bar down, lock out elbows", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "skull_crusher", name: "Skull Crusher", category: "Strength", muscleGroup: "Triceps", equipment: "Barbell", description: "Lower bar to forehead, extend arms", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "dips", name: "Tricep Dips", category: "Bodyweight", muscleGroup: "Triceps", equipment: "None", description: "Dip between parallel bars, upright torso", defaultSets: 3, defaultReps: "10-15", defaultRestSeconds: 75 },
  { id: "overhead_tricep", name: "Overhead Tricep Extension", category: "Strength", muscleGroup: "Triceps", equipment: "Dumbbell", description: "Hold dumbbell overhead, lower behind head", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "close_grip_bench", name: "Close Grip Bench Press", category: "Strength", muscleGroup: "Triceps", equipment: "Barbell", description: "Narrow grip bench press for tricep focus", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 75 },
  { id: "cable_overhead_tricep", name: "Cable Overhead Tricep", category: "Strength", muscleGroup: "Triceps", equipment: "Cable", description: "Face away from cable, extend rope overhead", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "kickback", name: "Tricep Kickback", category: "Strength", muscleGroup: "Triceps", equipment: "Dumbbell", description: "Bent over, extend arm back until straight", defaultSets: 3, defaultReps: "12-15 each", defaultRestSeconds: 45 },

  // Core (8)
  { id: "plank", name: "Plank", category: "Core", muscleGroup: "Core", equipment: "None", description: "Hold forearm plank position", defaultSets: 3, defaultReps: "30-60 sec", defaultRestSeconds: 45 },
  { id: "side_plank", name: "Side Plank", category: "Core", muscleGroup: "Core", equipment: "None", description: "Hold lateral plank on one forearm", defaultSets: 3, defaultReps: "20-40 sec each", defaultRestSeconds: 30 },
  { id: "crunches", name: "Crunches", category: "Core", muscleGroup: "Core", equipment: "None", description: "Lie down, crunch upper body toward knees", defaultSets: 3, defaultReps: "20-25", defaultRestSeconds: 45 },
  { id: "bicycle_crunch", name: "Bicycle Crunch", category: "Core", muscleGroup: "Core", equipment: "None", description: "Alternate elbow to opposite knee in crunch motion", defaultSets: 3, defaultReps: "20 each side", defaultRestSeconds: 45 },
  { id: "leg_raises", name: "Leg Raises", category: "Core", muscleGroup: "Core", equipment: "None", description: "Lie flat, raise legs to 90 degrees", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 45 },
  { id: "russian_twist", name: "Russian Twist", category: "Core", muscleGroup: "Core", equipment: "None", description: "Seated, rotate torso side to side", defaultSets: 3, defaultReps: "20 each side", defaultRestSeconds: 45 },
  { id: "ab_wheel", name: "Ab Wheel Rollout", category: "Core", muscleGroup: "Core", equipment: "Equipment", description: "On knees, roll wheel out and back in", defaultSets: 3, defaultReps: "8-12", defaultRestSeconds: 60 },
  { id: "dragon_flag", name: "Dragon Flag", category: "Core", muscleGroup: "Core", equipment: "None", description: "Lie on bench, lift body from shoulders", defaultSets: 3, defaultReps: "6-8", defaultRestSeconds: 60 },

  // Cardio / HIIT (10)
  { id: "mountain_climber", name: "Mountain Climbers", category: "Cardio", muscleGroup: "Full Body", equipment: "None", description: "Plank position, drive knees to chest alternately", defaultSets: 3, defaultReps: "30 sec", defaultRestSeconds: 30 },
  { id: "burpee", name: "Burpees", category: "Cardio", muscleGroup: "Full Body", equipment: "None", description: "Jump, drop to plank, push up, jump up", defaultSets: 3, defaultReps: "10-15", defaultRestSeconds: 60 },
  { id: "jumping_jacks", name: "Jumping Jacks", category: "Cardio", muscleGroup: "Full Body", equipment: "None", description: "Jump with arms and legs out simultaneously", defaultSets: 3, defaultReps: "30-50", defaultRestSeconds: 30 },
  { id: "jump_rope", name: "Jump Rope", category: "Cardio", muscleGroup: "Full Body", equipment: "Jump Rope", description: "Skip rope at consistent pace", defaultSets: 3, defaultReps: "1 min", defaultRestSeconds: 30 },
  { id: "box_jump", name: "Box Jumps", category: "Cardio", muscleGroup: "Legs", equipment: "Box", description: "Jump onto box, step down carefully", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 60 },
  { id: "high_knees", name: "High Knees", category: "Cardio", muscleGroup: "Full Body", equipment: "None", description: "Run in place, bringing knees to waist height", defaultSets: 3, defaultReps: "30 sec", defaultRestSeconds: 30 },
  { id: "battle_ropes", name: "Battle Ropes", category: "Cardio", muscleGroup: "Full Body", equipment: "Equipment", description: "Alternate wave motion with ropes", defaultSets: 3, defaultReps: "30 sec", defaultRestSeconds: 45 },
  { id: "rowing", name: "Rowing Machine", category: "Cardio", muscleGroup: "Full Body", equipment: "Machine", description: "Drive with legs, swing back, pull to chest", defaultSets: 3, defaultReps: "2 min", defaultRestSeconds: 60 },
  { id: "treadmill_sprint", name: "Treadmill Sprint Intervals", category: "Cardio", muscleGroup: "Full Body", equipment: "Machine", description: "30s sprint, 30s rest on treadmill", defaultSets: 6, defaultReps: "30 sec on/off", defaultRestSeconds: 30 },
  { id: "stair_climb", name: "Stair Climber", category: "Cardio", muscleGroup: "Legs", equipment: "Machine", description: "Steady climb on stair machine", defaultSets: 1, defaultReps: "10-15 min", defaultRestSeconds: 0 },

  // Yoga / Flexibility (5)
  { id: "surya_namaskar", name: "Surya Namaskar (Sun Salutation)", category: "Yoga", muscleGroup: "Full Body", equipment: "None", description: "12-pose dynamic yoga sequence", defaultSets: 5, defaultReps: "1 round", defaultRestSeconds: 30 },
  { id: "warrior_pose", name: "Warrior Pose Series", category: "Yoga", muscleGroup: "Full Body", equipment: "None", description: "Warrior 1, 2, and 3 sequence", defaultSets: 3, defaultReps: "30 sec each", defaultRestSeconds: 15 },
  { id: "downward_dog", name: "Downward Dog Hold", category: "Yoga", muscleGroup: "Full Body", equipment: "None", description: "Inverted V position, press heels to floor", defaultSets: 3, defaultReps: "45 sec", defaultRestSeconds: 15 },
  { id: "hip_flexor_stretch", name: "Hip Flexor Stretch", category: "Yoga", muscleGroup: "Legs", equipment: "None", description: "Low lunge position, hold and breathe", defaultSets: 3, defaultReps: "45 sec each", defaultRestSeconds: 15 },
  { id: "foam_roll", name: "Foam Rolling", category: "Yoga", muscleGroup: "Full Body", equipment: "Equipment", description: "Roll major muscle groups for 30-60s each", defaultSets: 1, defaultReps: "5 min", defaultRestSeconds: 0 },
  { id: "pigeon_pose", name: "Pigeon Pose", category: "Yoga", muscleGroup: "Legs", equipment: "None", description: "Deep hip opener, hold for 60s each side", defaultSets: 2, defaultReps: "60 sec each", defaultRestSeconds: 15 },
  { id: "child_pose", name: "Child's Pose", category: "Yoga", muscleGroup: "Full Body", equipment: "None", description: "Knees wide, arms extended forward, breathe deep", defaultSets: 3, defaultReps: "45 sec", defaultRestSeconds: 15 },
  { id: "cat_cow", name: "Cat-Cow Stretch", category: "Yoga", muscleGroup: "Full Body", equipment: "None", description: "Alternate spinal flexion and extension on all fours", defaultSets: 2, defaultReps: "10 cycles", defaultRestSeconds: 15 },

  // Additional Strength / Full Body (10)
  { id: "clean_press", name: "Clean and Press", category: "Strength", muscleGroup: "Full Body", equipment: "Barbell", description: "Power clean to front rack, press overhead", defaultSets: 4, defaultReps: "5", defaultRestSeconds: 120 },
  { id: "kettlebell_swing", name: "Kettlebell Swing", category: "Strength", muscleGroup: "Full Body", equipment: "Kettlebell", description: "Hinge and swing kettlebell to shoulder height", defaultSets: 4, defaultReps: "15-20", defaultRestSeconds: 60 },
  { id: "turkish_getup", name: "Turkish Get Up", category: "Strength", muscleGroup: "Full Body", equipment: "Kettlebell", description: "Rise from floor to stand with weight overhead", defaultSets: 3, defaultReps: "5 each side", defaultRestSeconds: 90 },
  { id: "farmers_walk", name: "Farmer's Walk", category: "Strength", muscleGroup: "Full Body", equipment: "Dumbbell", description: "Walk carrying heavy dumbbells at sides", defaultSets: 4, defaultReps: "30 m", defaultRestSeconds: 60 },
  { id: "trap_bar_deadlift", name: "Trap Bar Deadlift", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Stand inside hex bar, deadlift with neutral grip", defaultSets: 4, defaultReps: "6-8", defaultRestSeconds: 120 },
  { id: "sumo_deadlift", name: "Sumo Deadlift", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Wide stance, hands inside legs, pull bar up", defaultSets: 4, defaultReps: "5-6", defaultRestSeconds: 120 },
  { id: "power_clean", name: "Power Clean", category: "Strength", muscleGroup: "Full Body", equipment: "Barbell", description: "Explosive pull, catch bar in quarter squat", defaultSets: 4, defaultReps: "4-5", defaultRestSeconds: 120 },
  { id: "hack_squat", name: "Hack Squat Machine", category: "Strength", muscleGroup: "Legs", equipment: "Machine", description: "Squat on angled machine, feet shoulder-width", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 90 },
  { id: "cable_pull_through", name: "Cable Pull Through", category: "Strength", muscleGroup: "Legs", equipment: "Cable", description: "Hinge at hips, pull cable through legs", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "zercher_squat", name: "Zercher Squat", category: "Strength", muscleGroup: "Legs", equipment: "Barbell", description: "Bar in elbow crooks, squat deep", defaultSets: 3, defaultReps: "8-10", defaultRestSeconds: 90 },
  { id: "meadows_row", name: "Meadows Row", category: "Strength", muscleGroup: "Back", equipment: "Barbell", description: "Angled barbell row for upper back thickness", defaultSets: 3, defaultReps: "10-12 each", defaultRestSeconds: 60 },
  { id: "pendlay_row", name: "Pendlay Row", category: "Strength", muscleGroup: "Back", equipment: "Barbell", description: "Strict bent-over row from the floor each rep", defaultSets: 4, defaultReps: "6-8", defaultRestSeconds: 90 },
  { id: "seal_row", name: "Seal Row", category: "Strength", muscleGroup: "Back", equipment: "Barbell", description: "Prone on bench, row barbell from dead hang", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 75 },
  { id: "cable_fly", name: "Cable Chest Fly", category: "Strength", muscleGroup: "Chest", equipment: "Cable", description: "Arms wide, bring cables together at chest", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "incline_fly", name: "Incline Dumbbell Fly", category: "Strength", muscleGroup: "Chest", equipment: "Dumbbell", description: "Incline bench fly for upper chest stretch", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "nordic_curl", name: "Nordic Hamstring Curl", category: "Strength", muscleGroup: "Legs", equipment: "None", description: "Kneel with feet anchored, lower body slowly", defaultSets: 3, defaultReps: "6-8", defaultRestSeconds: 90 },
  { id: "glute_bridge", name: "Glute Bridge", category: "Strength", muscleGroup: "Legs", equipment: "None", description: "Lie on back, push hips to ceiling", defaultSets: 3, defaultReps: "15-20", defaultRestSeconds: 45 },
  { id: "step_ups", name: "Step Ups", category: "Strength", muscleGroup: "Legs", equipment: "Box", description: "Step onto box, drive through heel to stand", defaultSets: 3, defaultReps: "12 each", defaultRestSeconds: 60 },
  { id: "wall_sit", name: "Wall Sit", category: "Bodyweight", muscleGroup: "Legs", equipment: "None", description: "Back on wall, thighs parallel to floor, hold", defaultSets: 3, defaultReps: "45-60 sec", defaultRestSeconds: 60 },
  { id: "sissy_squat", name: "Sissy Squat", category: "Bodyweight", muscleGroup: "Legs", equipment: "None", description: "Lean back, bend knees, lower to the floor", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "zottman_curl", name: "Zottman Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Curl up supinated, lower in pronated position", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "incline_curl", name: "Incline Dumbbell Curl", category: "Strength", muscleGroup: "Biceps", equipment: "Dumbbell", description: "Seated on incline, arms hanging, curl up", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "diamond_pushup", name: "Diamond Push Up", category: "Bodyweight", muscleGroup: "Triceps", equipment: "None", description: "Hands in diamond shape under chest", defaultSets: 3, defaultReps: "12-15", defaultRestSeconds: 60 },
  { id: "pike_pushup", name: "Pike Push Up", category: "Bodyweight", muscleGroup: "Shoulders", equipment: "None", description: "Inverted V position, lower head to floor", defaultSets: 3, defaultReps: "10-12", defaultRestSeconds: 60 },
  { id: "windmill", name: "Windmill (Kettlebell)", category: "Strength", muscleGroup: "Core", equipment: "Kettlebell", description: "Arm overhead, hinge to side, rotate torso", defaultSets: 3, defaultReps: "6-8 each", defaultRestSeconds: 60 },
];

export const EXERCISE_CATEGORIES = [...new Set(EXERCISES.map((e) => e.category))];
export const MUSCLE_GROUPS = [...new Set(EXERCISES.map((e) => e.muscleGroup))];

export function searchExercises(query: string, category?: string): Exercise[] {
  let results = EXERCISES;
  if (category && category !== "All") {
    if (category === "Arms") {
      results = results.filter((e) => e.muscleGroup === "Biceps" || e.muscleGroup === "Triceps");
    } else {
      results = results.filter((e) => e.category === category || e.muscleGroup === category);
    }
  }
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q),
    );
  }
  return results;
}

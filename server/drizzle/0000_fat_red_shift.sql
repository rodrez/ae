CREATE TABLE "characters" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" text NOT NULL,
	"level" integer DEFAULT 1,
	"experience" integer DEFAULT 0,
	"health" integer DEFAULT 100,
	"mana" integer DEFAULT 100,
	"inventory" jsonb DEFAULT '{"items":[]}'::jsonb,
	"position" jsonb,
	"last_saved" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_objects" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"properties" jsonb DEFAULT '{}'::jsonb,
	"respawn_time" timestamp,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "instance_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"instance_id" integer,
	"character_id" integer,
	"joined_at" timestamp DEFAULT now(),
	"left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp,
	"max_players" integer,
	"current_players" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_login" timestamp,
	"is_online" boolean DEFAULT false,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_players" ADD CONSTRAINT "instance_players_instance_id_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."instances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance_players" ADD CONSTRAINT "instance_players_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE no action ON UPDATE no action;
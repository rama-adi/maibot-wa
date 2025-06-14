CREATE TABLE `top_user_songs` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`songs` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `top_user_songs_user_id_idx` ON `top_user_songs` (`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY NOT NULL,
	`phone_number_hash` text,
	`public_id` text NOT NULL,
	`name` text NOT NULL,
	`is_banned` integer NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`rating` integer DEFAULT 0 NOT NULL,
	`fav_song` integer
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "phone_number_hash", "public_id", "name", "is_banned", "bio", "rating", "fav_song") SELECT "id", "phone_number_hash", "public_id", "name", "is_banned", "bio", "rating", "fav_song" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_hash_unique` ON `users` (`phone_number_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);--> statement-breakpoint
CREATE INDEX `users_id_idx` ON `users` (`id`);--> statement-breakpoint
CREATE INDEX `users_public_id_idx` ON `users` (`public_id`);--> statement-breakpoint
CREATE INDEX `users_phone_hash_idx` ON `users` (`phone_number_hash`);--> statement-breakpoint
CREATE INDEX `users_name_idx` ON `users` (`name`);
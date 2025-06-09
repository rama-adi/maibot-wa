CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`phone_number_hash` text,
	`public_id` text,
	`name` text NOT NULL,
	`is_banned` integer NOT NULL,
	`bio` text DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_phone_number_hash_unique` ON `users` (`phone_number_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_public_id_unique` ON `users` (`public_id`);--> statement-breakpoint
CREATE INDEX `users_id_idx` ON `users` (`id`);--> statement-breakpoint
CREATE INDEX `users_public_id_idx` ON `users` (`public_id`);--> statement-breakpoint
CREATE INDEX `users_phone_hash_idx` ON `users` (`phone_number_hash`);--> statement-breakpoint
CREATE INDEX `users_name_idx` ON `users` (`name`);
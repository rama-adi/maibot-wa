CREATE TABLE `admins` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_id_idx` ON `admins` (`id`);--> statement-breakpoint
CREATE TABLE `allowed_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`rate_limit` integer DEFAULT 1000
);
--> statement-breakpoint
CREATE INDEX `allowed_groups_rate_limit_idx` ON `allowed_groups` (`rate_limit`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`rate_limit` integer DEFAULT 0,
	`resets_at` integer
);
--> statement-breakpoint
CREATE INDEX `rate_limits_resets_at_idx` ON `rate_limits` (`resets_at`);
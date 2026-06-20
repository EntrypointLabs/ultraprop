CREATE TABLE "accounts" (
	"account_id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"tier" text NOT NULL,
	"status" text DEFAULT 'evaluating' NOT NULL,
	"starting_equity" numeric(20, 8) NOT NULL,
	"profit_target" numeric(10, 6) NOT NULL,
	"max_drawdown" numeric(10, 6) NOT NULL,
	"daily_loss" numeric(10, 6) NOT NULL,
	"leverage_cap" numeric(10, 2) NOT NULL,
	"intent_cap" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invite_redemptions" (
	"code" text PRIMARY KEY NOT NULL,
	"redeemed_by" text NOT NULL,
	"account_id" text,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_digests" (
	"digest" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"account_id" text,
	"amount" numeric(20, 8),
	"used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"client_trade_id" text,
	"market_id" text NOT NULL,
	"side" text NOT NULL,
	"size_usd" numeric(20, 8) NOT NULL,
	"leverage" numeric(10, 2) NOT NULL,
	"margin_mode" text NOT NULL,
	"entry_price" numeric(20, 8) NOT NULL,
	"entry_fee_usd" numeric(20, 8) NOT NULL,
	"funding_paid" numeric(20, 8) DEFAULT '0' NOT NULL,
	"take_profit" numeric(20, 8),
	"stop_loss" numeric(20, 8),
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_funded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"exit_price" numeric(20, 8),
	"realized_pnl" numeric(20, 8),
	"close_reason" text,
	"on_chain_digest" text
);
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_accounts_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "positions_open_by_account_idx" ON "positions" USING btree ("account_id","status");
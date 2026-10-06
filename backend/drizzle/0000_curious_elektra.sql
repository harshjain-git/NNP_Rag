ALTER TABLE "documents" ADD COLUMN "content_hash" text;
--> statement-breakpoint
UPDATE "documents" SET "content_hash" = 'e5a115eecbe01191c6e05cd62d75c985a0a4c2247330dd3f43f6fe591a75297f' WHERE id = '879bfcc7-e8f7-4af3-b3e5-334197a68831';
--> statement-breakpoint
UPDATE "documents" SET "content_hash" = '1d0735ea4e4ca4b2feacc056a6cf2516a7a92f25d12093e931eef9724d670388' WHERE id = 'bc314bae-2827-485f-95ac-9469e2b9587b';
--> statement-breakpoint
UPDATE "documents" SET "content_hash" = '0631570509cbd83d3626f7efe339a27e7ada278e28210548f219bce41ded0882' WHERE id = '8c35389f-5e72-4987-b96f-6a6e0e995301';
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "content_hash" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_content_hash_unique" UNIQUE("content_hash");
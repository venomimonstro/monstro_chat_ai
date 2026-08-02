-- Sprint 35: deployment history + stability monitoring

CREATE TYPE "DeploymentRecordStatus" AS ENUM ('active', 'superseded', 'rolled_back');
CREATE TYPE "StabilityComponentStatus" AS ENUM ('ok', 'degraded', 'down');

CREATE TABLE "deployment_records" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "sprint" INTEGER NOT NULL,
    "git_sha" TEXT,
    "status" "DeploymentRecordStatus" NOT NULL DEFAULT 'active',
    "manifest_json" JSONB,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolled_back_at" TIMESTAMP(3),

    CONSTRAINT "deployment_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "deployment_records_version_idx" ON "deployment_records"("version");
CREATE INDEX "deployment_records_sprint_idx" ON "deployment_records"("sprint");
CREATE INDEX "deployment_records_status_idx" ON "deployment_records"("status");
CREATE INDEX "deployment_records_applied_at_idx" ON "deployment_records"("applied_at");

CREATE TABLE "stability_checks" (
    "id" UUID NOT NULL,
    "component" TEXT NOT NULL,
    "status" "StabilityComponentStatus" NOT NULL,
    "message" TEXT,
    "latency_ms" INTEGER,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stability_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stability_checks_component_checked_at_idx" ON "stability_checks"("component", "checked_at");

CREATE TABLE "stability_incidents" (
    "id" UUID NOT NULL,
    "component" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "auto_fix_attempted" BOOLEAN NOT NULL DEFAULT false,
    "auto_fix_success" BOOLEAN,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stability_incidents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "stability_incidents_component_created_at_idx" ON "stability_incidents"("component", "created_at");
CREATE INDEX "stability_incidents_resolved_at_idx" ON "stability_incidents"("resolved_at");

using Microsoft.EntityFrameworkCore.Migrations;

public partial class AddEmailAlertSystem : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Email Templates
        migrationBuilder.Sql(@"
            CREATE TABLE IF NOT EXISTS ""EmailTemplates"" (
                ""Id""        SERIAL PRIMARY KEY,
                ""Name""      VARCHAR(100) NOT NULL,
                ""Subject""   VARCHAR(200) NOT NULL,
                ""Body""      TEXT NOT NULL,
                ""IsDefault"" BOOLEAN NOT NULL DEFAULT false,
                ""CreatedAt"" TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS ""CreditAlertRules"" (
                ""Id""               SERIAL PRIMARY KEY,
                ""ThresholdCredits"" INT NOT NULL,
                ""EmailTemplateId""  INT NOT NULL REFERENCES ""EmailTemplates""(""Id"") ON DELETE CASCADE,
                ""IsEnabled""        BOOLEAN NOT NULL DEFAULT true
            );

            CREATE TABLE IF NOT EXISTS ""CreditAlertLog"" (
                ""Id""        BIGSERIAL PRIMARY KEY,
                ""MemberId""  INT NOT NULL REFERENCES ""Users""(""Id"") ON DELETE CASCADE,
                ""RuleId""    INT NOT NULL REFERENCES ""CreditAlertRules""(""Id"") ON DELETE CASCADE,
                ""SentAt""    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            ALTER TABLE ""ClubSettings""
                ADD COLUMN IF NOT EXISTS ""CreditAlertsEnabled""        BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS ""CreditAlertCooldownEnabled"" BOOLEAN NOT NULL DEFAULT false,
                ADD COLUMN IF NOT EXISTS ""CreditAlertCooldownDays""    INT     NOT NULL DEFAULT 7;
        ");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(@"
            DROP TABLE IF EXISTS ""CreditAlertLog"";
            DROP TABLE IF EXISTS ""CreditAlertRules"";
            DROP TABLE IF EXISTS ""EmailTemplates"";
            ALTER TABLE ""ClubSettings""
                DROP COLUMN IF EXISTS ""CreditAlertsEnabled"",
                DROP COLUMN IF EXISTS ""CreditAlertCooldownEnabled"",
                DROP COLUMN IF EXISTS ""CreditAlertCooldownDays"";
        ");
    }
}
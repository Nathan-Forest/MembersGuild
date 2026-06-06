public record ClubSettingsResponse(
    // Identity
    string DisplayName,
    string? LogoUrl,
    string PrimaryColor,
    string SecondaryColor,
    // Membership
    string AssociationNumberLabel,
    int CatsInitialCredits,
    string CatsDescription,
    // Attendance
    string AttendanceLanesLabel,
    bool AttendanceLanesEnabled,
    // Regional
    string ClubTimezone,
    // Credits
    string CreditPriceAud,
    // Welcome Email (Phase 10)
    string WelcomeEmailSubject,
    string WelcomeEmailBody,
    string CatsNotificationEmail,
    bool TrainingMetricsEnabled,
    bool TrainingSetsEnabled,
    bool TrainingVideosEnabled
);

public record UpdateClubSettingsRequest(
    string DisplayName,
    string PrimaryColor,
    string SecondaryColor,
    string AssociationNumberLabel,
    int CatsInitialCredits,
    string CatsDescription,
    string AttendanceLanesLabel,
    bool AttendanceLanesEnabled,
    string ClubTimezone,
    string CreditPriceAud,
    string WelcomeEmailSubject,
    string WelcomeEmailBody,
    string CatsNotificationEmail,
    bool TrainingMetricsEnabled,
    bool TrainingSetsEnabled,
    bool TrainingVideosEnabled
    
);

public record CatsFieldRequest(
    string  FieldLabel,
    string  FieldType,
    string? FieldOptions,
    bool    IsRequired
);

public record ReportRecipientDto(string Name, string Email);
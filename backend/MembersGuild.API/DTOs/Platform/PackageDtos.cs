namespace MembersGuild.API.DTOs.Platform;

public record PackageResponse(
    int      Id,
    string   Name,
    string   Type,
    decimal  Price,
    string?  Description,
    bool     IsActive,
    int      SortOrder,
    List<string> FeatureKeys
);

public record CreatePackageRequest(
    string   Name,
    string   Type,
    decimal  Price,
    string?  Description,
    List<string> FeatureKeys
);

public record UpdatePackageRequest(
    string   Name,
    decimal  Price,
    string?  Description,
    bool     IsActive,
    List<string> FeatureKeys
);

public record ClubBillingResponse(
    int      ClubId,
    string   Slug,
    string   DisplayName,
    string   DiscountType,
    decimal  DiscountValue,
    string?  DiscountNote,
    decimal  GrossMonthly,
    decimal  NetMonthly,
    List<PackageResponse> Packages
);

public record UpdateClubBillingRequest(
    string   DiscountType,
    decimal  DiscountValue,
    string?  DiscountNote,
    List<int> PackageIds
);

public record RevenueSummaryResponse(
    decimal TotalMrr,
    int     ActiveClubs,
    int     FreeClubs,
    List<TierBreakdown> ByPackage
);

public record TierBreakdown(
    string  PackageName,
    int     ClubCount,
    decimal Mrr
);
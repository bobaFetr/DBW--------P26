using Microsoft.AspNetCore.Identity;
using MyLibrary;

namespace MyApi.Services;

public class BcryptPasswordHasher : IPasswordHasher<ApplicationUser>
{
    private const int WorkFactor = 12;

    public string HashPassword(ApplicationUser user, string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password, WorkFactor);
    }

    public PasswordVerificationResult VerifyHashedPassword(
        ApplicationUser user,
        string hashedPassword,
        string providedPassword)
    {
        if (string.IsNullOrWhiteSpace(hashedPassword))
        {
            return PasswordVerificationResult.Failed;
        }

        if (hashedPassword.StartsWith("$2", StringComparison.Ordinal))
        {
            return BCrypt.Net.BCrypt.Verify(providedPassword, hashedPassword)
                ? PasswordVerificationResult.Success
                : PasswordVerificationResult.Failed;
        }

        var identityHasher = new PasswordHasher<ApplicationUser>();
        var result = identityHasher.VerifyHashedPassword(user, hashedPassword, providedPassword);

        return result == PasswordVerificationResult.Failed
            ? PasswordVerificationResult.Failed
            : PasswordVerificationResult.SuccessRehashNeeded;
    }
}

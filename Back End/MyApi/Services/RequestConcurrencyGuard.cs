using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MyApi.Services;

public static class RequestConcurrencyGuard
{
    // The action's transaction is disposed (and rolled back) before errors
    // reach this boundary. Never replay approval side effects automatically.
    public static async Task<ActionResult<T>> ExecuteAsync<T>(Func<Task<ActionResult<T>>> action)
    {
        try
        {
            return await action();
        }
        catch (Exception exception) when (IsConcurrencyConflict(exception))
        {
            return new ConflictObjectResult(
                "This request was changed by another action. Refresh and check its current status.");
        }
    }

    private static bool IsConcurrencyConflict(Exception exception)
    {
        for (Exception? current = exception; current is not null; current = current.InnerException)
        {
            if (current is DbUpdateConcurrencyException ||
                current is PostgresException
                {
                    SqlState: PostgresErrorCodes.SerializationFailure or PostgresErrorCodes.DeadlockDetected
                })
            {
                return true;
            }
        }

        return false;
    }
}

namespace MembersGuild.API.Middleware;

public class PlatformKeyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IConfiguration _config;

    public PlatformKeyMiddleware(RequestDelegate next, IConfiguration config)
    {
        _next = next;
        _config = config;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (context.Request.Path.StartsWithSegments("/platform") &&
            !context.Request.Path.StartsWithSegments("/platform/stripe/webhook"))
        {
            var provided = context.Request.Headers["X-Platform-Key"].ToString();
            var expected = _config["Platform:ApiKey"];

            if (string.IsNullOrEmpty(provided) || provided != expected)
            {
                context.Response.StatusCode = 403;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(
                    "{\"error\":\"Invalid or missing platform API key\"}");
                return;
            }
        }

        await _next(context);
    }
}
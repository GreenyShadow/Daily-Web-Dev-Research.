using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors();

var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrWhiteSpace(port) && int.TryParse(port, out var portNumber))
{
    builder.WebHost.UseUrls($"http://localhost:{portNumber}");
}
else
{
    builder.WebHost.UseUrls("http://localhost:3000");
}

var app = builder.Build();
app.UseCors(policy => policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());

var dataFile = Path.Combine(AppContext.BaseDirectory, "tickets.json");
var fileLock = new SemaphoreSlim(1, 1);
var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = true,
};

async Task<List<Ticket>> LoadTicketsAsync()
{
    await fileLock.WaitAsync();
    try
    {
        if (!File.Exists(dataFile))
        {
            return new List<Ticket>();
        }

        var raw = await File.ReadAllTextAsync(dataFile);
        return string.IsNullOrWhiteSpace(raw)
            ? new List<Ticket>()
            : JsonSerializer.Deserialize<List<Ticket>>(raw, jsonOptions) ?? new List<Ticket>();
    }
    finally
    {
        fileLock.Release();
    }
}

async Task SaveTicketsAsync(List<Ticket> tickets)
{
    await fileLock.WaitAsync();
    try
    {
        var json = JsonSerializer.Serialize(tickets, jsonOptions);
        await File.WriteAllTextAsync(dataFile, json);
    }
    finally
    {
        fileLock.Release();
    }
}

string GenerateId(int length = 12)
{
    const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var bytes = RandomNumberGenerator.GetBytes(length);
    var result = new char[length];

    for (var i = 0; i < length; i++)
    {
        result[i] = chars[bytes[i] % chars.Length];
    }

    return new string(result);
}

app.MapGet("/health", () => Results.Json(new { status = "ok", message = "Ticket API is running" }));

app.MapGet("/tickets", async () => await LoadTicketsAsync());

app.MapGet("/tickets/{id}", async (string id) =>
{
    var tickets = await LoadTicketsAsync();
    var ticket = tickets.Find(item => item.Id == id);

    return ticket is null
        ? Results.NotFound(new { error = "Ticket not found" })
        : Results.Ok(ticket);
});

app.MapPost("/tickets", async (TicketInput input) =>
{
    if (string.IsNullOrWhiteSpace(input.Name) ||
        string.IsNullOrWhiteSpace(input.Department) ||
        string.IsNullOrWhiteSpace(input.Priority) ||
        string.IsNullOrWhiteSpace(input.Title))
    {
        return Results.BadRequest(new { error = "Missing required fields: name, department, priority, title" });
    }

    var tickets = await LoadTicketsAsync();
    var ticket = new Ticket
    {
        Id = GenerateId(),
        Name = input.Name.Trim(),
        Department = input.Department.Trim(),
        Priority = input.Priority.Trim(),
        Topic = input.Topic?.Trim() ?? string.Empty,
        Title = input.Title.Trim(),
        Description = input.Description?.Trim() ?? string.Empty,
        CreatedAt = DateTime.UtcNow.ToString("o"),
        Status = "pending",
    };

    tickets.Add(ticket);
    await SaveTicketsAsync(tickets);

    return Results.Created($"/tickets/{ticket.Id}", ticket);
});

app.MapMethods("/tickets/{id}", new[] { "PATCH" }, async (string id, HttpRequest request) =>
{
    var updates = await JsonSerializer.DeserializeAsync<Dictionary<string, JsonElement>>(request.Body, jsonOptions);
    if (updates is null)
    {
        return Results.BadRequest(new { error = "Invalid request body" });
    }

    var tickets = await LoadTicketsAsync();
    var index = tickets.FindIndex(item => item.Id == id);
    if (index == -1)
    {
        return Results.NotFound(new { error = "Ticket not found" });
    }

    var ticket = tickets[index];
    var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "status",
        "priority",
        "topic",
        "title",
        "description",
        "department",
        "name",
    };

    foreach (var (key, value) in updates)
    {
        if (!allowed.Contains(key))
        {
            continue;
        }

        var normalizedKey = key.ToLowerInvariant();
        var stringValue = value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => null,
            _ => value.GetRawText(),
        };

        if (stringValue is null)
        {
            continue;
        }

        switch (normalizedKey)
        {
            case "status": ticket.Status = stringValue; break;
            case "priority": ticket.Priority = stringValue; break;
            case "topic": ticket.Topic = stringValue; break;
            case "title": ticket.Title = stringValue; break;
            case "description": ticket.Description = stringValue; break;
            case "department": ticket.Department = stringValue; break;
            case "name": ticket.Name = stringValue; break;
        }
    }

    tickets[index] = ticket;
    await SaveTicketsAsync(tickets);

    return Results.Ok(ticket);
});

app.MapDelete("/tickets/{id}", async (string id) =>
{
    var tickets = await LoadTicketsAsync();
    var filtered = tickets.Where(item => item.Id != id).ToList();

    if (filtered.Count == tickets.Count)
    {
        return Results.NotFound(new { error = "Ticket not found" });
    }

    await SaveTicketsAsync(filtered);
    return Results.StatusCode(204);
});

app.Run();

public class Ticket
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Priority { get; set; } = string.Empty;
    public string Topic { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string CreatedAt { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class TicketInput
{
    public string? Name { get; set; }
    public string? Department { get; set; }
    public string? Priority { get; set; }
    public string? Topic { get; set; }
    public string? Title { get; set; }
    public string? Description { get; set; }
}

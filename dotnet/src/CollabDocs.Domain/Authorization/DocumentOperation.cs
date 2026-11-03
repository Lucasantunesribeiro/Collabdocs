namespace CollabDocs.Domain.Authorization;

/// <summary>Operações sobre um documento sujeitas a autorização.</summary>
public enum DocumentOperation
{
    Read,
    ListCollaborators,
    EditContent,
    Rename,
    ChangeVisibility,
    Delete,
    ManageCollaborators,
    ConnectRealtime,
    SendRealtimeUpdate,
}

from pydantic import BaseModel


class ChatThemePalette(BaseModel):
    screenBackground: str
    titleText: str
    statusText: str
    composerBackground: str
    composerText: str
    composerPlaceholder: str
    userBubbleBackground: str
    userBubbleText: str
    assistantBubbleBackground: str
    assistantBubbleText: str
    loaderBubbleBackground: str
    loaderDotActive: str
    loaderDotInactive: str
    toolCardBackground: str
    toolCardBorder: str
    toolCardTitle: str
    toolCardBody: str


class ChatThemeOut(BaseModel):
    light: ChatThemePalette
    dark: ChatThemePalette


class ChatThemeUpdate(ChatThemeOut):
    pass

from pydantic import BaseModel, Field


class PhotoTypeSuggestion(BaseModel):
    case_type_code: str
    # Kurumdaki Turkce adi; form aciklamaya bunu yazabilir
    name: str
    confidence: float = Field(ge=0, le=1)


class PhotoSuggestRead(BaseModel):
    # False: sunucuda goruntu modeli yok; form oneri gostermez
    available: bool
    suggestions: list[PhotoTypeSuggestion]

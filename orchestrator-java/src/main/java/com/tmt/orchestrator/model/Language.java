package com.tmt.orchestrator.model;

/**
 * Supported languages for translation.
 */
public enum Language {
    EN("en", "English"),
    NE("ne", "नेपाली (Nepali)"),
    TAM("tam", "तामाङ (Tamang)");

    private final String code;
    private final String displayName;

    Language(String code, String displayName) {
        this.code = code;
        this.displayName = displayName;
    }

    public String getCode() {
        return code;
    }

    public String getDisplayName() {
        return displayName;
    }

    /**
     * Find Language by code string, case-insensitive.
     */
    public static Language fromCode(String code) {
        for (Language lang : values()) {
            if (lang.code.equalsIgnoreCase(code)) {
                return lang;
            }
        }
        throw new IllegalArgumentException("Unknown language code: " + code);
    }
}

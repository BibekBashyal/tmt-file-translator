package com.tmt.orchestrator.client;

import java.util.List;

/**
 * Interface for TMT API translation client.
 * Designed for easy swap between mock and real implementations.
 */
public interface TmtApiClient {

    /**
     * Translate a batch of texts from source to target language.
     *
     * @param texts      List of text strings to translate
     * @param sourceLang Source language code (en, ne, tam)
     * @param targetLang Target language code (en, ne, tam)
     * @return List of translated texts in the same order as input
     */
    List<String> translate(List<String> texts, String sourceLang, String targetLang);
}

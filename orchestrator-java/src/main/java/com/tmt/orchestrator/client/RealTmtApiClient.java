package com.tmt.orchestrator.client;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.List;
import java.util.Map;

/**
 * Real TMT API client — placeholder for production integration.
 * Activated when app.tmt-api.mock=false.
 * 
 * TODO: Implement actual TMT API contract once credentials are available.
 */
@Component
@ConditionalOnProperty(name = "app.tmt-api.mock", havingValue = "false")
public class RealTmtApiClient implements TmtApiClient {

    private static final Logger log = LoggerFactory.getLogger(RealTmtApiClient.class);

    private final WebClient webClient;

    public RealTmtApiClient(
        @Value("${app.tmt-api.url}") String tmtApiUrl
    ) {
        this.webClient = WebClient.builder()
            .baseUrl(tmtApiUrl)
            .build();
    }

    @Override
    public List<String> translate(List<String> texts, String sourceLang, String targetLang) {
        log.info("Real TMT API call: {} texts, {} → {}", texts.size(), sourceLang, targetLang);

        // TODO: Replace with actual TMT API call
        // Expected format (to be confirmed):
        // POST /translate
        // {
        //   "texts": ["Hello", "World"],
        //   "source": "en",
        //   "target": "ne"
        // }
        // Response:
        // {
        //   "translations": ["नमस्ते", "संसार"]
        // }

        Map<String, Object> requestBody = Map.of(
            "texts", texts,
            "source", sourceLang,
            "target", targetLang
        );

        @SuppressWarnings("unchecked")
        Map<String, Object> response = webClient.post()
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(Map.class)
            .block();

        if (response != null && response.containsKey("translations")) {
            @SuppressWarnings("unchecked")
            List<String> translations = (List<String>) response.get("translations");
            return translations;
        }

        throw new RuntimeException("Invalid TMT API response");
    }
}

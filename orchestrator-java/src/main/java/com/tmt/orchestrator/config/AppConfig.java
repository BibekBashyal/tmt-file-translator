package com.tmt.orchestrator.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.ExchangeStrategies;

/**
 * Application-wide configuration: WebClient, executor settings.
 */
@Configuration
public class AppConfig {

    @Value("${app.doc-service-url}")
    private String docServiceUrl;

    /**
     * WebClient for calling the Python doc-service.
     * Configured with increased buffer size for large file transfers.
     */
    @Bean
    public WebClient docServiceWebClient() {
        // Increase buffer size to 2MB for file transfers
        ExchangeStrategies strategies = ExchangeStrategies.builder()
            .codecs(configurer -> configurer
                .defaultCodecs()
                .maxInMemorySize(2 * 1024 * 1024))
            .build();

        return WebClient.builder()
            .baseUrl(docServiceUrl)
            .exchangeStrategies(strategies)
            .build();
    }
}

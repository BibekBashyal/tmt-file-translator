package com.tmt.orchestrator.config;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.TimeUnit;

/**
 * Caffeine cache configuration for translation results.
 * 
 * Key: SHA-256(text + sourceLang + targetLang)
 * Value: translated text string
 */
@Configuration
public class CacheConfig {

    @Value("${app.cache.max-size:50000}")
    private long maxSize;

    @Value("${app.cache.expire-hours:6}")
    private long expireHours;

    @Bean
    public Cache<String, String> translationCache() {
        return Caffeine.newBuilder()
            .maximumSize(maxSize)
            .expireAfterWrite(expireHours, TimeUnit.HOURS)
            .recordStats()
            .build();
    }
}

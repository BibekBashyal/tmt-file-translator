package com.tmt.orchestrator.service;

import com.tmt.orchestrator.client.TmtApiClient;
import com.tmt.orchestrator.model.Segment;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class TranslationService {

    private static final Logger log = LoggerFactory.getLogger(TranslationService.class);

    private final TmtApiClient tmtApiClient;

    public TranslationService(TmtApiClient tmtApiClient) {
        this.tmtApiClient = tmtApiClient;
    }

    /**
     * Translate segments sequentially — one API call at a time, throttled by RealTmtApiClient.
     * Returned list order matches input order.
     */
    public List<Segment> translateSegments(
        List<Segment> segments, String sourceLang, String targetLang
    ) {
        if (segments.isEmpty()) return segments;
        log.info("Translating {} segments sequentially src={} tgt={}", segments.size(), sourceLang, targetLang);

        List<Segment> results = new ArrayList<>(segments.size());
        for (Segment seg : segments) {
            List<String> translated = tmtApiClient.translate(List.of(seg.text()), sourceLang, targetLang);
            String text = translated.isEmpty() ? seg.text() : translated.get(0);
            results.add(seg.withText(text));
        }
        return results;
    }
}

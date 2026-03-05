package com.mahesh.transit.controllers;

import com.mahesh.transit.services.BusService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/bus")
public class BusController {

    @Autowired
    private BusService busService;

    @GetMapping("/search")
    public ResponseEntity<List<Map<String, Object>>> getBuses(
            @RequestParam String source,
            @RequestParam String destination) {
        List<Map<String, Object>> results = busService.search(source, destination);
        return ResponseEntity.ok(results);
    }

    /** Autocomplete endpoint — returns stop names starting with the given query */
    @GetMapping("/stops")
    public ResponseEntity<List<String>> getStops(@RequestParam String query) {
        return ResponseEntity.ok(busService.searchStopNames(query));
    }

    /** Route Details endpoint — next departures & intermediate stops */
    @GetMapping("/route-details")
    public ResponseEntity<Map<String, Object>> getRouteDetails(
            @RequestParam String bus,
            @RequestParam String source,
            @RequestParam String destination,
            @RequestParam(required = false) String time) {
        
        if (time == null) {
            time = java.time.LocalTime.now().format(java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss"));
        }
        return ResponseEntity.ok(busService.getRouteDetails(bus, source, destination, time));
    }

    /** Health-check endpoint — useful for verifying the backend is up */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "ok", "service", "TGSRTC"));
    }
}
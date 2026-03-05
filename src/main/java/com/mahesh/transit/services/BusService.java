package com.mahesh.transit.services;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class BusService {

    private final JdbcTemplate jdbc;

    public BusService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // -------------------------------------------------------------------------
    // Public search entry point
    // -------------------------------------------------------------------------

    /**
     * Returns direct buses first. Connecting routes are only returned when
     * there are no direct buses available.
     */
    public List<Map<String, Object>> search(String source, String destination) {
        List<Map<String, Object>> results = new ArrayList<>();

        // 1. Direct buses (checked across ALL matching stop IDs)
        List<String> directBuses = findDirectBuses(source, destination);
        for (String bus : directBuses) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("type",  "direct");
            entry.put("bus",   bus);
            entry.put("from",  source);
            entry.put("to",    destination);
            results.add(entry);
        }

        // 2. Connecting route — only when NO direct buses exist
        if (directBuses.isEmpty()) {
            List<String> route = findConnectingRoute(source, destination);
            for (String step : route) {
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("type", "connecting");
                entry.put("step", step);
                results.add(entry);
            }
        }

        return results;
    }

    // -------------------------------------------------------------------------
    // Stop name autocomplete
    // -------------------------------------------------------------------------

    /**
     * Returns up to 10 distinct stop names whose name starts with the given query
     * (case-insensitive). Used to power the frontend autocomplete dropdown.
     */
    public List<String> searchStopNames(String query) {
        if (query == null || query.trim().isEmpty()) return Collections.emptyList();
        return jdbc.queryForList(
            "SELECT DISTINCT stop_name FROM stops " +
            "WHERE stop_name ILIKE ? " +
            "ORDER BY stop_name LIMIT 10",
            String.class, query.trim() + "%"
        );
    }

    // -------------------------------------------------------------------------
    // Direct-bus search using SQL
    // -------------------------------------------------------------------------

    /**
     * Finds all bus route short-names that serve both the source and destination
     * stops in the correct order (source stop_sequence < destination stop_sequence).
     *
     * Works across ALL stop IDs that match the given name (handles duplicate stop
     * names like two "Charminar" stops).
     */
    public List<String> findDirectBuses(String sourceName, String destName) {
        List<String> sourceIds = findStopIdsByName(sourceName);
        List<String> destIds   = findStopIdsByName(destName);

        if (sourceIds.isEmpty() || destIds.isEmpty()) {
            System.out.println("DEBUG findDirectBuses: no stop IDs found for '" + sourceName + "' or '" + destName + "'");
            return Collections.emptyList();
        }

        System.out.println("DEBUG findDirectBuses: sourceIds=" + sourceIds + " destIds=" + destIds);

        // Build IN-clause placeholders
        String srcPlaceholders  = placeholders(sourceIds.size());
        String destPlaceholders = placeholders(destIds.size());

        /*
         * Find trips that contain a source stop AND a destination stop
         * where source comes before destination (by stop_sequence),
         * then join to get the route short name.
         */
        String sql =
            "SELECT DISTINCT r.route_short_name " +
            "FROM stop_times src_st " +
            "JOIN stop_times dst_st ON src_st.trip_id = dst_st.trip_id " +
            "JOIN trips t  ON t.trip_id  = src_st.trip_id " +
            "JOIN routes r ON r.route_id = t.route_id " +
            "WHERE src_st.stop_id IN (" + srcPlaceholders  + ") " +
            "  AND dst_st.stop_id IN (" + destPlaceholders + ") " +
            "  AND src_st.stop_sequence < dst_st.stop_sequence";

        // Combine params: source IDs first, then dest IDs
        Object[] params = buildParams(sourceIds, destIds);

        List<String> buses = jdbc.queryForList(sql, String.class, params);
        System.out.println("DEBUG findDirectBuses: found=" + buses);
        return buses;
    }

    // -------------------------------------------------------------------------
    // Route Details (Next departures & intermediate stops)
    // -------------------------------------------------------------------------

    public Map<String, Object> getRouteDetails(String bus, String sourceName, String destName, String currentTime) {
        List<String> sourceIds = findStopIdsByName(sourceName);
        List<String> destIds   = findStopIdsByName(destName);

        if (sourceIds.isEmpty() || destIds.isEmpty()) return Collections.emptyMap();

        String srcPlaceholders  = placeholders(sourceIds.size());
        String destPlaceholders = placeholders(destIds.size());

        // 1. Get next 8 departure times at the source stop for this valid route heading to destination
        String timesSql =
            "SELECT DISTINCT src_st.arrival_time " +
            "FROM stop_times src_st " +
            "JOIN stop_times dst_st ON src_st.trip_id = dst_st.trip_id " +
            "JOIN trips t  ON t.trip_id  = src_st.trip_id " +
            "JOIN routes r ON r.route_id = t.route_id " +
            "WHERE r.route_short_name = ? " +
            "  AND src_st.stop_id IN (" + srcPlaceholders  + ") " +
            "  AND dst_st.stop_id IN (" + destPlaceholders + ") " +
            "  AND src_st.stop_sequence < dst_st.stop_sequence " +
            "  AND src_st.arrival_time >= ? " +
            "ORDER BY src_st.arrival_time ASC LIMIT 8";

        List<Object> timesParams = new ArrayList<>();
        timesParams.add(bus);
        timesParams.addAll(sourceIds);
        timesParams.addAll(destIds);
        timesParams.add(currentTime);

        List<String> nextDepartures = jdbc.queryForList(timesSql, String.class, timesParams.toArray());

        // 2. Wrap back to ANY trip of this route solving the constraints to grab intermediate stops
        String tripInfoSql =
            "SELECT t.trip_id, src_st.stop_sequence AS src_seq, dst_st.stop_sequence AS dst_seq " +
            "FROM stop_times src_st " +
            "JOIN stop_times dst_st ON src_st.trip_id = dst_st.trip_id " +
            "JOIN trips t  ON t.trip_id  = src_st.trip_id " +
            "JOIN routes r ON r.route_id = t.route_id " +
            "WHERE r.route_short_name = ? " +
            "  AND src_st.stop_id IN (" + srcPlaceholders  + ") " +
            "  AND dst_st.stop_id IN (" + destPlaceholders + ") " +
            "  AND src_st.stop_sequence < dst_st.stop_sequence " +
            "LIMIT 1";

        List<Object> tripParams = new ArrayList<>();
        tripParams.add(bus);
        tripParams.addAll(sourceIds);
        tripParams.addAll(destIds);

        List<Map<String, Object>> tripInfos = jdbc.queryForList(tripInfoSql, tripParams.toArray());

        List<String> stops = new ArrayList<>();
        if (!tripInfos.isEmpty()) {
            Map<String, Object> info = tripInfos.get(0);
            String tripId = (String) info.get("trip_id");
            int srcSeq = (Integer) info.get("src_seq");
            int dstSeq = (Integer) info.get("dst_seq");

            String stopsSql =
                "SELECT s.stop_name " +
                "FROM stop_times st " +
                "JOIN stops s ON s.stop_id = st.stop_id " +
                "WHERE st.trip_id = ? " +
                "  AND st.stop_sequence >= ? " +
                "  AND st.stop_sequence <= ? " +
                "ORDER BY st.stop_sequence ASC";

            stops = jdbc.queryForList(stopsSql, String.class, tripId, srcSeq, dstSeq);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("departures", nextDepartures);
        result.put("stops", stops);
        return result;
    }

    // -------------------------------------------------------------------------
    // Connecting-route search using BFS over adjacency data from the DB
    // -------------------------------------------------------------------------

    /**
     * BFS over the transit graph (built from stop_times) to find a connecting
     * path when no direct bus exists. Tries all matching source stop IDs and
     * returns the shortest path found.
     */
    public List<String> findConnectingRoute(String startName, String endName) {
        List<String> startIds = findStopIdsByName(startName);
        List<String> endIds   = findStopIdsByName(endName);

        if (startIds.isEmpty() || endIds.isEmpty()) {
            return Collections.singletonList("Stop not found.");
        }

        Set<String> endIdSet = new HashSet<>(endIds);

        // Load adjacency list from the database once (stop → next stops via bus)
        Map<String, List<Connection>> adjacency = buildAdjacencyList();

        List<String> bestPath = null;

        for (String startId : startIds) {
            Queue<String> queue = new LinkedList<>();
            Map<String, String> parentTracker = new HashMap<>();
            Map<String, String> busTracker    = new HashMap<>();

            queue.add(startId);
            parentTracker.put(startId, null);

            while (!queue.isEmpty()) {
                String current = queue.poll();

                if (endIdSet.contains(current)) {
                    List<String> path = reconstructPath(current, parentTracker, busTracker);
                    if (bestPath == null || path.size() < bestPath.size()) {
                        bestPath = path;
                    }
                    break;
                }

                List<Connection> neighbours = adjacency.getOrDefault(current, Collections.emptyList());
                for (Connection conn : neighbours) {
                    if (!parentTracker.containsKey(conn.toStopId)) {
                        parentTracker.put(conn.toStopId, current);
                        busTracker.put(conn.toStopId, conn.busNumber);
                        queue.add(conn.toStopId);
                    }
                }
            }
        }

        return bestPath != null ? bestPath : Collections.singletonList("No route found.");
    }

    // -------------------------------------------------------------------------
    // Stop name → ID resolution (handles multiple stops with same name)
    // -------------------------------------------------------------------------

    /**
     * Returns ALL stop IDs matching the given name.
     * Exact matches take priority; partial (ILIKE) matches used as fallback.
     */
    private List<String> findStopIdsByName(String name) {
        String trimmed = name.trim();

        // Exact match (case-insensitive)
        List<String> exact = jdbc.queryForList(
            "SELECT stop_id FROM stops WHERE LOWER(stop_name) = LOWER(?)",
            String.class, trimmed
        );
        if (!exact.isEmpty()) {
            System.out.println("DEBUG findStopIdsByName: exact for '" + trimmed + "' -> " + exact);
            return exact;
        }

        // Partial match
        List<String> partial = jdbc.queryForList(
            "SELECT stop_id FROM stops WHERE stop_name ILIKE ?",
            String.class, "%" + trimmed + "%"
        );
        System.out.println("DEBUG findStopIdsByName: partial for '" + trimmed + "' -> " + partial);
        return partial;
    }

    // -------------------------------------------------------------------------
    // Graph building (loaded on-demand for BFS)
    // -------------------------------------------------------------------------

    private static class Connection {
        final String toStopId;
        final String busNumber;
        Connection(String toStopId, String busNumber) {
            this.toStopId  = toStopId;
            this.busNumber = busNumber;
        }
    }

    /**
     * Builds a stop-level adjacency list from consecutive stop_times rows.
     * Only consecutive stops within the same trip are connected.
     */
    private Map<String, List<Connection>> buildAdjacencyList() {
        // Fetch ordered stop_times with route short name in one query
        String sql =
            "SELECT st.trip_id, st.stop_id, st.stop_sequence, r.route_short_name " +
            "FROM stop_times st " +
            "JOIN trips  t ON t.trip_id  = st.trip_id " +
            "JOIN routes r ON r.route_id = t.route_id " +
            "ORDER BY st.trip_id, st.stop_sequence";

        // Group by trip_id
        Map<String, List<Object[]>> byTrip = new LinkedHashMap<>();
        jdbc.query(sql, rs -> {
            String tripId    = rs.getString("trip_id");
            String stopId    = rs.getString("stop_id");
            int    seq       = rs.getInt("stop_sequence");
            String routeName = rs.getString("route_short_name");
            byTrip.computeIfAbsent(tripId, k -> new ArrayList<>())
                  .add(new Object[]{stopId, seq, routeName});
        });

        Map<String, List<Connection>> adjacency = new HashMap<>();
        for (List<Object[]> stopTimes : byTrip.values()) {
            for (int i = 0; i < stopTimes.size() - 1; i++) {
                String fromStop  = (String) stopTimes.get(i)[0];
                String toStop    = (String) stopTimes.get(i + 1)[0];
                String busNumber = (String) stopTimes.get(i)[2];
                adjacency.computeIfAbsent(fromStop, k -> new ArrayList<>())
                         .add(new Connection(toStop, busNumber));
            }
        }
        return adjacency;
    }

    // -------------------------------------------------------------------------
    // Path reconstruction
    // -------------------------------------------------------------------------

    private List<String> reconstructPath(String endId,
                                         Map<String, String> parents,
                                         Map<String, String> buses) {
        List<String> directions = new ArrayList<>();
        String current = endId;
        while (parents.get(current) != null) {
            String prev    = parents.get(current);
            String bus     = buses.get(current);
            String prevName    = stopName(prev);
            String currentName = stopName(current);
            directions.add(0, "At " + prevName + ", board Bus " + bus + " → Get off at " + currentName);
            current = prev;
        }
        return directions;
    }

    private String stopName(String stopId) {
        List<String> names = jdbc.queryForList(
            "SELECT stop_name FROM stops WHERE stop_id = ?", String.class, stopId
        );
        return names.isEmpty() ? stopId : names.get(0);
    }

    // -------------------------------------------------------------------------
    // SQL helpers
    // -------------------------------------------------------------------------

    private static String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private static Object[] buildParams(List<String> a, List<String> b) {
        Object[] params = new Object[a.size() + b.size()];
        int i = 0;
        for (String s : a) params[i++] = s;
        for (String s : b) params[i++] = s;
        return params;
    }
}
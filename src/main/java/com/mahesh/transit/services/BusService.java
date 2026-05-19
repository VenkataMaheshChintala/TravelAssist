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

        List<Map<String, Object>> stops = new ArrayList<>();
        if (!tripInfos.isEmpty()) {
            Map<String, Object> info = tripInfos.get(0);
            String tripId = (String) info.get("trip_id");
            int srcSeq = (Integer) info.get("src_seq");
            int dstSeq = (Integer) info.get("dst_seq");

            String stopsSql =
                "SELECT s.stop_name, s.stop_lat, s.stop_lon " +
                "FROM stop_times st " +
                "JOIN stops s ON s.stop_id = st.stop_id " +
                "WHERE st.trip_id = ? " +
                "  AND st.stop_sequence >= ? " +
                "  AND st.stop_sequence <= ? " +
                "ORDER BY st.stop_sequence ASC";

            stops = jdbc.queryForList(stopsSql, tripId, srcSeq, dstSeq);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("departures", nextDepartures);
        result.put("stops", stops);
        return result;
    }

    // -------------------------------------------------------------------------
    // Connecting-route search using BFS over adjacency data from the DB
    // -------------------------------------------------------------------------

    public List<String> findConnectingRoute(String startName, String endName) {
        List<String> startIds = findStopIdsByName(startName);
        List<String> endIds   = findStopIdsByName(endName);

        if (startIds.isEmpty() || endIds.isEmpty()) {
            return Collections.singletonList("Stop not found.");
        }

        Set<String> endIdSet = new HashSet<>(endIds);
        Map<String, List<Connection>> adjacency = buildAdjacencyList();

        List<String> bestPath = null;
        int bestTransfers = Integer.MAX_VALUE;

        for (String startId : startIds) {
            PriorityQueue<Node> pq = new PriorityQueue<>();
            Map<String, Integer> minCostToState = new HashMap<>(); // stateKey -> cost

            pq.add(new Node(startId, "", 0, 0, null));
            minCostToState.put(startId + "|", 0);

            while (!pq.isEmpty()) {
                Node current = pq.poll();

                if (endIdSet.contains(current.stopId)) {
                    if (bestPath == null || current.transfers < bestTransfers) {
                        bestPath = reconstructDijkstraPath(current);
                        bestTransfers = current.transfers;
                    }
                    break;
                }

                List<Connection> neighbours = adjacency.getOrDefault(current.stopId, Collections.emptyList());
                for (Connection conn : neighbours) {
                    boolean isTransfer = !current.busNumber.isEmpty() && !current.busNumber.equals(conn.busNumber);
                    int newTransfers = current.transfers + (isTransfer ? 1 : 0);
                    int newHops = current.hops + 1;

                    // Limit to max 2 transfers for realistic transit routes
                    if (newTransfers > 2) continue;

                    int cost = newTransfers * 10000 + newHops;
                    String stateKey = conn.toStopId + "|" + conn.busNumber;

                    if (cost < minCostToState.getOrDefault(stateKey, Integer.MAX_VALUE)) {
                        minCostToState.put(stateKey, cost);
                        pq.add(new Node(conn.toStopId, conn.busNumber, newHops, newTransfers, current));
                    }
                }
            }
        }

        return bestPath != null ? bestPath : Collections.singletonList("No connecting route found.");
    }

    // -------------------------------------------------------------------------
    // Stop name → ID resolution (handles multiple stops with same name)
    // -------------------------------------------------------------------------

    private List<String> findStopIdsByName(String name) {
        String trimmed = name.trim();
        List<String> exact = jdbc.queryForList(
            "SELECT stop_id FROM stops WHERE LOWER(stop_name) = LOWER(?)",
            String.class, trimmed
        );
        if (!exact.isEmpty()) return exact;

        return jdbc.queryForList(
            "SELECT stop_id FROM stops WHERE stop_name ILIKE ?",
            String.class, "%" + trimmed + "%"
        );
    }

    private String stopName(String stopId) {
        List<String> names = jdbc.queryForList(
            "SELECT stop_name FROM stops WHERE stop_id = ?", String.class, stopId
        );
        return names.isEmpty() ? stopId : names.get(0);
    }

    // -------------------------------------------------------------------------
    // Graph building
    // -------------------------------------------------------------------------

    private static class Connection {
        final String toStopId;
        final String busNumber;
        Connection(String toStopId, String busNumber) {
            this.toStopId  = toStopId;
            this.busNumber = busNumber;
        }
    }

    private Map<String, List<Connection>> buildAdjacencyList() {
        String sql =
            "SELECT st.trip_id, st.stop_id, st.stop_sequence, r.route_short_name " +
            "FROM stop_times st " +
            "JOIN trips  t ON t.trip_id  = st.trip_id " +
            "JOIN routes r ON r.route_id = t.route_id " +
            "ORDER BY st.trip_id, st.stop_sequence";

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

    private static class Node implements Comparable<Node> {
        String stopId;
        String busNumber;
        int hops;
        int transfers;
        Node parent;

        Node(String stopId, String busNumber, int hops, int transfers, Node parent) {
            this.stopId = stopId;
            this.busNumber = busNumber;
            this.hops = hops;
            this.transfers = transfers;
            this.parent = parent;
        }

        @Override
        public int compareTo(Node other) {
            if (this.transfers != other.transfers) {
                return Integer.compare(this.transfers, other.transfers);
            }
            return Integer.compare(this.hops, other.hops);
        }
    }

    // -------------------------------------------------------------------------
    // Path reconstruction
    // -------------------------------------------------------------------------

    private List<String> reconstructDijkstraPath(Node endNode) {
        List<String> directions = new ArrayList<>();
        List<Node> path = new ArrayList<>();
        
        Node curr = endNode;
        while (curr != null) {
            if (curr.parent != null) { 
                path.add(curr);
            }
            curr = curr.parent;
        }
        Collections.reverse(path);
        
        if (path.isEmpty()) return directions;

        String currentBus = path.get(0).busNumber;
        String boardStopId = path.get(0).parent.stopId;
        
        for (int i = 0; i < path.size(); i++) {
            Node n = path.get(i);
            if (!n.busNumber.equals(currentBus)) {
                String alightStopId = path.get(i - 1).stopId;
                directions.add("At " + stopName(boardStopId) + ", board Bus " + currentBus + " → Get off at " + stopName(alightStopId));
                currentBus = n.busNumber;
                boardStopId = alightStopId;
            }
        }
        
        String finalStopId = path.get(path.size() - 1).stopId;
        directions.add("At " + stopName(boardStopId) + ", board Bus " + currentBus + " → Get off at " + stopName(finalStopId));

        return directions;
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
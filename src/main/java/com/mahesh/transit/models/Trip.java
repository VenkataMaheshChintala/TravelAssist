package com.mahesh.transit.models;

public class Trip {
    public String tripId, routeId;

    public Trip(String tripId, String routeId) {
        this.routeId = routeId;
        this.tripId = tripId;
    }
}

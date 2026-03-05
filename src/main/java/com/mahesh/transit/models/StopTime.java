package com.mahesh.transit.models;

public class StopTime {
    public String tripId, stopId;
    public int stopSequence;

    public StopTime(String tripId, String stopId, int stopSequence) {
        this.tripId = tripId;
        this.stopId = stopId;
        this.stopSequence = stopSequence;
    }
}

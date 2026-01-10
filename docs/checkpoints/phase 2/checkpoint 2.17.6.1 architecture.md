sequenceDiagram
    participant User
    participant NC as NavigationController
    participant BV as BenchmarkView
    participant AS as AppStateService

    User->>NC: Clicks "Benchmarks"
    NC->>AS: Get activeTabId
    NC->>BV: tryReturnToTable()
    
    alt Folder View was Open
        BV->>AS: setIsFolderViewOpen(false)
        BV->>BV: render() (Lock: ON)
        Note over BV: Rebuilds DOM once
        BV-->>NC: returns true (wasFolderDismissed)
    else Folder View was Closed
        BV-->>NC: returns false
    end

    NC->>AS: setActiveTabId("nav-benchmarks")

    alt Tab was different AND Folder not dismissed
        NC->>BV: render() (Lock: ON)
    else Tab already active OR Folder was dismissed
        Note over NC: Skip redundant render
    end
```

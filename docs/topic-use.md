# Operating System Topics Used

Mapping follows the project brief; no separate institutional syllabus was supplied. “Implemented” below always means an educational frontend model.

| Module / topic | Status | Actual use and source |
|---|---|---|
| OS fundamentals / resource management | Partially used | Finite parking bays assigned to competing vehicle processes (`src/simulation/parking.js`). |
| Shell scripting | Not used | No OS shell teaching module. |
| Process | Implemented | Vehicle request creates a PID and process record. |
| PCB | Implemented | Click PID to inspect vehicle, state, arrival, burst, priority, slot, waiting, turnaround and history (`src/pages/Processes.jsx`). |
| Process states | Implemented | Checked NEW → READY → RUNNING → TERMINATED; RUNNING → WAITING → READY when resources unavailable/released. |
| FCFS | Implemented | Arrival order, idle segments, completion/turnaround/waiting metrics. |
| Non-preemptive priority | Implemented | Lower number wins among arrived jobs; stable arrival ties. |
| Round Robin | Implemented | Configurable quantum, FIFO ready queue, boundary arrivals and repeated execution segments. |
| Concurrency / race condition | Simulated | Deterministic interleaving of two reads and allocations (`src/simulation/labs.js`). |
| Critical section | Simulated | Check bay → allocate → update state. |
| Mutual exclusion | Simulated | Explicit lock ownership and sequential access; not a real kernel mutex. |
| Producer–consumer | Simulated | Entry gate produces FIFO requests; allocator consumes them in isolated sandbox. |
| Bounded buffer | Implemented model | Capacity 5; full/empty operations do not mutate queue. |
| Deadlock | Simulated | Predefined two-process/two-resource single-instance wait cycle. |
| Deadlock recovery | Simulated | P2 victim rollback releases R2, then P1 owns R1 and R2. |
| Threads / kernel scheduling | Not implemented | Browser callbacks animate deterministic models; no real OS thread control. |
| Memory management, paging, segmentation | Not used | Outside supplied project scope. |
| Filesystems, disk scheduling, real IPC | Not used | No corresponding teaching modules. |

## Timing and allocation semantics
Scheduling sandbox uses CPU service units: turnaround = completion − arrival; waiting = turnaround − burst. All results are calculated by pure `schedule()` in `src/algorithms/scheduling.js`.

The dashboard uses a separate logical clock. Every READY request has already arrived at the moment of allocation. FCFS uses original arrival order; Priority selects the highest priority current request; Round Robin selects the first simulated service completion. The allocator models CPU service completion before assigning a bay. A parked process remains RUNNING to illustrate resource ownership until exit, so PCB turnaround includes parking residence and is not the sandbox CPU-only turnaround. PCB waiting counts arrival to allocation service start. These abstractions are explicitly educational, not literal CPU execution while a car is parked.

C4 admits priority 3 only; other bays accept all priorities. Releasing any occupied bay wakes all WAITING requests; a subsequent allocation may put an ineligible request back into WAITING. No automatic priority aging or starvation prevention is claimed.

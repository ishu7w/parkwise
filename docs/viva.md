# Implementation-specific viva questions

1. **Why is a vehicle a process?** It is a teaching analogy: each request has a PID, state, priority, arrival and service burst, and competes for limited resources.
2. **What is in the PCB?** PID, vehicle number, state, arrival, burst, priority, assigned slot, waiting/turnaround and transition history.
3. **Why does an emergency request not always execute first in Priority?** Only arrived requests are eligible, and service is non-preemptive. In the sample, P1 starts at t=0 before emergency P2 arrives at t=1.
4. **How are metrics calculated?** Completion is the end of the last CPU segment. Turnaround is completion minus arrival. Waiting is turnaround minus burst in the CPU sandbox.
5. **What happens at a Round Robin quantum boundary?** New arrivals join before the unfinished process is re-enqueued. With quantum 2 the sample order is P1, P2, P3, P1, P4, P2, P3, P1.
6. **What are the known average waiting times?** FCFS 4.75; Priority 4.25; Round Robin quantum 2: 7.00.
7. **Why does the dashboard use a different timing model?** It shows resource residence. A parked process remains simulated RUNNING until exit. Sandbox CPU service finishes independently of parking duration.
8. **What is the critical section?** Checking availability, allocating a slot and updating shared status must be treated as one protected operation.
9. **Is this a real mutex?** No. The app uses deterministic interleaved steps to demonstrate mutual exclusion. Browser execution is not a kernel-lock implementation.
10. **How does the race occur?** P101 and P102 both read AVAILABLE before either finishes the update, then both claim A1 using stale observations.
11. **What happens when parking is full?** A selected READY request enters RUNNING then WAITING. Exiting a parked vehicle releases its bay and wakes WAITING requests to READY.
12. **What makes C4 reserved?** Eligibility excludes it unless the selected request has priority 3; reservation is actual allocation logic.
13. **How is the buffer bounded?** Production at length 5 and consumption at length 0 return waiting messages without mutating the FIFO queue.
14. **What are the four deadlock conditions?** Mutual exclusion, hold and wait, no preemption, circular wait. Both single-instance resources are held in a predefined cycle.
15. **How does recovery work?** P2 is chosen as a victim and rolled back; R2 is released; P1 acquires R2. Recovery deliberately interrupts normal ownership.
16. **Can a cycle always prove deadlock?** For this single-instance resource example yes. General multiple-instance graphs require more analysis; this project does not implement that detector.
17. **Can priority scheduling starve a process?** Yes. Aging could mitigate starvation but is not implemented here.
18. **Does the UI require WebGL?** No. The current interface uses DOM and SVG with Lenis and GSAP. Reduced-motion preferences disable decorative motion and use native scrolling.
19. **Why frontend only?** It makes the demonstration deterministic, portable and independent of servers or hardware. State persists in localStorage where available.
20. **What verifies correctness?** Known-result algorithm tests, process/resource invariant tests, buffer and recovery tests, and browser checks across four widths.

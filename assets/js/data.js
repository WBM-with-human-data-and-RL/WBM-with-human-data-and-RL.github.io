// Every number on the page comes from the manuscript (Fig. 4, Table III).
// Successes are out of 20 trials unless a `trials` field says otherwise.

export const TRIALS = 20;

/** Fig. 4: pretrained-only vs. post-trained checkpoints, by environment group. */
export const BEFORE_AFTER = {
  unseen: [
    { task: 'Push door', before: 3, after: 17 },
    { task: 'Pull door', before: 2, after: 16 },
    { task: 'Pick up toy bread', before: 12, after: 20 },
    { task: 'Pick up empty can', before: 12, after: 20 },
    { task: 'Pick up 300 g cube', before: 7, after: 20 },
    { task: 'Whole-body box carrying', before: 0, after: 16 },
  ],
  seen: [
    { task: 'Push door', before: 9, after: 19 },
    { task: 'Pull door', before: 5, after: 18 },
    { task: 'Pick up toy bread', before: 16, after: 20 },
    { task: 'Pick up empty can', before: 18, after: 20 },
    { task: 'Pick up 300 g cube', before: 14, after: 20 },
    { task: 'Whole-body box carrying', before: 0, after: 18 },
  ],
};

/** Table III: unseen-site successes under matched robot budgets. */
export const ABLATION_TASKS = [
  { name: 'Push door', trials: 20 },
  { name: 'Pull door', trials: 20 },
  { name: 'Any-object pickup', trials: 60 },
  { name: 'Whole-body box carrying', trials: 20 },
];

export const ABLATIONS = [
  { label: 'Robot teleoperation data for pretraining only', humanData: 'no human data; trained on 20 minutes of teleoperated robot demonstrations',
    robotMin: 20, critic: false, successes: [13, 9, 50, 13] },
  { label: 'In-distribution human data for pretraining only', humanData: 'pretrained only on 25 minutes of human data matching the robot\u2019s own cameras and grippers, then corrected on the robot',
    robotMin: 20, critic: true, successes: [15, 15, 55, 14] },
  { label: 'Diverse human data pretraining only', humanData: 'pretrained on the full six-source human-data mixture; the robot is never corrected',
    robotMin: 0, critic: false, successes: [3, 2, 31, 0] },
  { label: 'Ours: diverse human data pretraining + 20 minutes correction data post-training', humanData: 'pretrained on the full human-data mixture, then post-trained with human-in-the-loop offline RL',
    robotMin: 20, critic: true, successes: [17, 16, 60, 16], ours: true },
  { label: 'Ours, but all robot data weighted equally', humanData: 'same recipe without the learned critic: every logged action counts the same',
    robotMin: 20, critic: false, successes: [13, 12, 51, 14] },
  { label: 'Ours, but corrections upweighted by a fixed rule', humanData: 'same recipe with a hand-set weight on operator corrections instead of a learned critic',
    robotMin: 20, critic: false, successes: [14, 13, 55, 14] },
];

export const pct = (successes, trials = TRIALS) => Math.round((100 * successes) / trials);

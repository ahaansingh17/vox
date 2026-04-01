import { stallNudge, assumptionCheckPrompt } from '../prompts/index.js'

export function createStallDetector() {
  let stalledFor = 0
  let lastCompletedCount = 0
  let lastPlan = ''
  let lastUnderstanding = ''
  let assumptionCheckSent = false

  return {
    check(journal, planningComplete) {
      const currentPlan = journal.currentPlan || ''
      const currentUnderstanding = journal.understanding || ''
      const planUnchanged = currentPlan === lastPlan
      const completedUnchanged = journal.completed.length === lastCompletedCount
      const understandingUnchanged = currentUnderstanding === lastUnderstanding

      lastCompletedCount = journal.completed.length
      lastPlan = currentPlan
      lastUnderstanding = currentUnderstanding

      if (!planningComplete) {
        if (understandingUnchanged && planUnchanged && !currentPlan) {
          stalledFor++
          if (stalledFor >= 3) {
            return {
              stalled: true,
              stalledFor,
              nudge:
                'You are stuck in the planning phase. You MUST call update_journal with at least understanding and currentPlan filled in. If you cannot plan this task, set done=true with doneReason explaining why.'
            }
          }
        } else {
          stalledFor = 0
        }
        return { stalled: stalledFor > 0, stalledFor, nudge: null }
      }

      if (planUnchanged && completedUnchanged) {
        stalledFor++
        let nudge = null
        if (stalledFor >= 2) nudge = stallNudge(stalledFor)
        if (stalledFor === 5 && !assumptionCheckSent && journal.blockers.length > 0) {
          nudge = assumptionCheckPrompt(journal.blockers)
          assumptionCheckSent = true
        }
        return { stalled: true, stalledFor, nudge }
      }

      stalledFor = 0
      assumptionCheckSent = false
      return { stalled: false, stalledFor: 0, nudge: null }
    },

    reset() {
      stalledFor = 0
      lastCompletedCount = 0
      lastPlan = ''
      lastUnderstanding = ''
      assumptionCheckSent = false
    }
  }
}

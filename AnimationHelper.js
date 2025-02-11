import { clamp, defineAnimation } from "react-native-reanimated";

var state = {}
const VELOCITY_EPS = 5;
const deceleration = 0.997;
export const withDecay = (initialVelocity) => {
    "worklet";
    return defineAnimation(() => {
        "worklet";
        const animation = (state, now) => {
            const { velocity, lastTimestamp, current } = state;
            const dt = now - lastTimestamp;
            const v0 = velocity / 1000;
            const kv = Math.pow(deceleration, dt)
            const v = v0 * kv * 1000;
            const x = current + (v0 * (deceleration * (1 - kv))) / (1 - deceleration);

            state.velocity = v;
            state.current = x;
            state.lastTimestamp = now;

            if (Math.abs(v) < VELOCITY_EPS) {
                return true
            }
            return false
        }
        const start = (state, current, now) => {
            state.current = current;
            state.velocity = initialVelocity;
            state.lastTimestamp = now
        }
        return { animation, start }
    })
}

const lowerBound = 0;
const upperBound = 0;
export const withBounce = (animationParam,) => {
    "worklet";
    return defineAnimation(() => {
        "worklet";
        const nextAnimation = animationParameter(animationParam);
        const animation = (state, now) => {
            const finished = nextAnimation.animation(nextAnimation, now);
            const { velocity, current } = nextAnimation;
            if (velocity < 0 && current < lowerBound || velocity > 0 && current > upperBound) {
                nextAnimation.velocity *= -0.5;
                nextAnimation.current = clamp(current, lowerBound, upperBound);
            }
            state.current = current;
            return finished;
        }
        const start = (state, value, now, previousAnimation) => {
            nextAnimation.start(nextAnimation, value, now, previousAnimation);
        }
        return {
            animation,
            start
        }
    })
}
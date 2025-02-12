What makes react native so specific when talking about gestures and animations?
The key to success is to avoid frame drops, which means that we have only 16ms to render everything, now 8ms on some devices.

# Simplified Architecture

<img width="804" alt="Screenshot 2025-02-07 at 3 42 02 PM" src="https://github.com/user-attachments/assets/0cac0e1e-f5ab-4352-ab49-9d0d5d56f6bf" />

We have the JavaScript thread, that runs the react code and the native thread that interacts with all the native APIs of the device. They talk to each other via asynchronous JSON messages.
So If the JavaScript thread is busy rendering your components or dealing with API calls, you are likely to miss this 16ms timeframe within your animation, or if your animation relies on messeges being exchanged between the native thread and the JavaScript thread, you are also likey to drop frames because the messegs won't be exchanged within that 16ms window.

```js
import React from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import useMakeJSThreadBusy from "./useMakeJSThreadBusy";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ball: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "red",
  },
});

const HeartOfTheMatter = () => {
  const position = new Animated.ValueXY({ x: 0, y: 0 });
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => {
      position.setOffset({
        x: position.x._value,
        y: position.y._value,
      });
      position.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: position.x, dy: position.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: () => {
      position.flattenOffset();
    },
  });
  useMakeJSThreadBusy(true, 1000);
  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.ball, position.getLayout()]}
        {...panResponder.panHandlers}
      />
    </View>
  );
};
export default HeartOfTheMatter;
```

The way we are going to solve this problem is by declaring all of our gestures and animations on the UI thread. So that even if the JavaScript thread is busy all the animations can run at 60fps even on low-end devices and wo we are not going to use the default animated API which relies on communication between the JavaScript thread and the UI thread, but on **Reanimated** and **React Native Gesture Handler**, which are dedicated on building declarative gestures and animations.

```js
import React from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import useMakeJSThreadBusy from "./useMakeJSThreadBusy";
import {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  ball: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "red",
  },
});

const HeartOfTheMatter = () => {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const onGestureEvent = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.x = x.value;
      ctx.y = y.value;
    },
    onActive: ({ translationX, translationY }, ctx) => {
      x.value = ctx.x + translationX;
      y.value = ctx.y + translationY;
    },
  });
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));
  // useMakeJSThreadBusy(true, 1000);
  return (
    <View style={styles.container}>
      <PanGestureHandler onGestureEvent={onGestureEvent}>
        <Animated.View style={[styles.ball, style]} />
      </PanGestureHandler>
    </View>
  );
};
export default HeartOfTheMatter;
```

In this case, it's being done declaratively using reanimated. So evenif javascript thread is busy, the animation will run at 60fps.

Reanimated is using Turbo modules, which enables direct communication between the UI thread and the JavaScript thread.

# Reanimated

Reanimated is a library that allows you to create animations and gestures declaratively. It is built on top of the UI thread and the JavaScript thread. Therefore chrome debugger won't be available anymore.

We were able to execute JavaScript bundle of the Chrome debugger and it could talk to the UI thread via JSON messages but it won't support the Turbo Modules API. Solution is to use AMS JavaScript Engine, which is dedicated for React Native an to use AMS debugger but AMS engine is not available with Expo.

# Worklets & Shared Values
Reanimated revolves around the concept of **Animation Worklets**: Which are JavaScript functions that run on the UI thread to compute animation frames. This is very similar to the concept of OpenGL Shaders. OpenGL Shaders are functions that are compiled and executed on the GPU. 

While Animation Worklets are JavaScript Functions that are executed on the UI thread. When wanting to animate the properties of a component, we need to wrap it so that the animated properties can be directly updated on the UI thread.
For instance, if we want to animate the style of a view:
```js
<View style={style} />
``` 

We are going to use ```Animated.View```:
```js
<Animated.View style={style} />
```

And you can wrap your own component using ```Animated.createAnimatedComponent``` component. 
```js
const AnimatedPath = Animated.createAnimatedComponent(Path);
```
This function looks up the undelying native component and make sure that all properties which are driven by animation values are updated directly on the UI thread.

Now there are two kinds of updated that are done on the UI thread:
- Direct Update
- Updates that are done via the React UI Manager, which is responsible for the FlexBox layout of the application using the Yoga Layout Engine

```js
const style = useAnimatedStyle(() => ({
    width: 100,
    height: 100,
    transform: [{ translateX: 100 }, { translateY: 100 }],
}))

return <Animated.View style={style} />
```

For instance if you animate width and height of an element, we need to update these properties via the React UI Manager, as it might affect the layout of the other elements. Or if you animate another property, such as transform here, changes of values in the transformer is not going to affect the layout of the other elements. So we can update these properties directly.

When buiding complex animations, you update all kinds of properties, this is a notion that is always useful to keep in mind. But some of these properties might be updated differently and therefore, may be run on different schedule.

**Reanimated** provides us with six hooks to build gestures and animations:
- **useSharedValue** & **useDerivedValue**: To create animation values. Here the names are very explicit. **useSharedValue** creates a shared animation value. We say shared because value is available on both the JavaScript thread and the UI thread. **useDerivedValue** derives from other animation values and this value is read only.

Then we can bind gestural events to animation values using **useAnimatedGestureHandler**. We can animate style and properties of components using **useAnimatedStyle** and **useAnimatedProps**.
**useAnimatedReaction** enables us to trigger side effect based on the state of our animation.

These hooks follow a functional model very similar to React Hooks. **useSharedValue** is very similar to **useState**. **useAnimatedStyle** and **useAnimatedProps** which are very similar to **render** function, in the sense that these needs to be pure functions. We wouldn't execute a side effect into a render. Here it's going to be the same with **Reanimated**, we are not going to execute a side effect in **useAnimatedStyle** or **useAnimatedProps**. It's understood that these needs to be pure functions.

**useAnimatedReaction** is very similar to **useEffect** hook. So based on some conditions, we want to trigger some side effect.

**useAnimatedGestureHandler** is very similar to **onPress** event in React. So we have an event that triggers some side effects.

Here we have the width variable from the React code, which we are using in the Animation Worklets.
```js
const width = 42;
const aWorklet = () => {
    "worklet";
    console.log("Width is", width);
}
```

The babel plugin is capable of capturing the width variable so that it's also available when executing the Animation worklet on the UI thread.
Now if this variable is a function so it's a function that lives on the JavaScript thread, so on a completely different context. You can also invoke this function from the **Animation worklet** by using **runOnJS** and here the function invocation is going to be done asynchronously.

```js
const myWorklet = (who) => {
    "worklet";
    console.log(`Hello ${who} from the UI thread.`);
}

const onPress = () => {
    runOnUI(myWorklet)("World");
}
```

In a symmetric way you can invoke code that lives on the UI thread from the JavaScript thread by using **runOnUI**.

In **Reanimated**, animation values are named shared values, because they are available on both the JavaScript thread and the UI thread. We can read and write the animation value using the **.value** property.

```js
import { useSharedValue } from "react-native-reanimated";

const HelloWorld = () => {
    const myValue = useSharedValue(0);
    console.log("myValue is ", myValue.value);
    return (
        <Button onPress={() => (myValue.value = Math.random())} title="Randomize" />
    )
}
```

We use the .value property so that we keep the same reference of an animation value, despite its actual value being constantly updated.

**Reanimated APIs** revolve around the concept of **worklets**. Worklets are JavaScript functions that are executed on the UI thread. 
**Animation Values** are named shared values. They are available on both the JavaScript thread and the UI thread.

The API provides us with 6 hooks to create values, listen to gesture events, animate properties and style, as well as to create side effects.

<img width="624" alt="Screenshot 2025-02-07 at 7 33 25 PM" src="https://github.com/user-attachments/assets/bb2c10ab-68e3-4a79-a062-f54d5a4a7568" />

Finally, the **Babel Plugin** is responsible to package **Animation Worklets** so that they can be executed on the UI thread and is capable of capturing the variables from the React code. If the variable is a function, you can invoke it using **runOnJS** and symmetrically, if you want to execute an **Animation Worklet** from the JavaScript thread from the react code, you can use **runOnUI**.

Short demo on how **Animation Worklets** and react code can talk with each other.
```js
import React from "react";
import { Button, StyleSheet, View } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});

const sayHello = () => {
  "worklet";
  console.log("Hello from the JS thread");
};
const Worklets = () => {
  return (
    <View style={styles.container}>
      <Button title="sayHello" label="sayHello" onPress={() => sayHello()} />
    </View>
  );
};
export default Worklets;
```

By using **worklet** directive under sayHello function, we are inicating to babel plugin that this function can be executed on the UI thread. And if we want to execute it on UI thread, we can invoke the function by using **runOnUI** function.
```js
<View style={styles.container}>
    <Button title="sayHello" label="sayHello" onPress={() => runOnUI(sayHello)("world")} />
</View>
```

In this case, we are invoking the **sayHello** function on the UI thread and passing the string "world" as an argument.

# Pan Gesture
Let's build our first gesture.

When we are building gestures or animations, we need to do three things:
- You need to create some animation values.
- You need to bind gestures to animation values. So you need to have some sort of communication between Gesture Handlers and animation values.
- You need to assign animation values to properties of React components. Can be animated proprties in the case of SVG for instance or animated style for views.

In this example we are going to use all of these hooks, so we are going to create shared values, x and y. useDerivedValue we are not going to use but **useDerivedValue** created animation values based on some worklet computations. So if your animation value depends on some sort of computation, some sort of may be conversion or other animation values, you can use **useDerivedValue**.

To bind animation values to gestures we use **useAnimatedGestureHandler**. This provides a really cool API that we will take a look at.

And finally we need to bind styles and properties from animation values to components. With **useAnimatedGestureHandler** we get different callbacks E.g. 
```js
onActive: (event, ctx)
```

Takes two parameters:
- event: contains all the values of our Gesture Handler. 
    - In the case of **PanGestureHandler**, you get the translationX, translationY, velocityX, velocityY, x, y, absoluteX, absoulteY.
    - If you have to use **PinGestureHandler**, you get scale, focalX, focalY and so on.
- ctx: Is a global object that is shared between each gesture event that you can use to make your gesture stateful. Since you can assign states to the subject, for each event you can remember things. So you can make your gesture stateful. Here we are going to use it to remember when we started the gesture again, where we were at the last position.

```js
const Gesture = ({ width, height }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const boundX = width - CARD_WIDTH;
  const boundY = height - CARD_HEIGHT;
  const onGestureEvent = useAnimatedGestureHandler({
    onStart: (event, ctx) => {
      ctx.offsetX = translateX.value;
      ctx.offsetY = translateY.value;
    },
    onActive: (event, ctx) => {
      translateX.value = clamp(ctx.offsetX + event.translationX, 0, boundX);
      translateY.value = clamp(ctx.offsetY + event.translationY, 0, boundY);
    },
    onEnd: (event, ctx) => {
      translateX.value = withDecay({
        velocity: event.velocityX,
        clamp: [0, boundX],
      });
      translateY.value = withDecay({
        velocity: event.velocityY,
        clamp: [0, boundY],
      });
    },
  });
  const style = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
    };
  });
  return (
    <View>
      <PanGestureHandler {...{ onGestureEvent }}>
        <Animated.View {...{ style }}>
          <Card card={Cards.Card1} />
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};
export default Gesture;
```

# Transitions
Transitions are the easiest way to animate React Native components.

Transition table
You can ease your transition from a change in the React state and here you are going to use **useTiming** or **useSpring**. Or you can trnasition on the change of animation value and for that you are going to use **withTiming** or **withSpring**.

So this is great to really add some nice animations when your react state change but also transitioning on any animation value can be convenient to decouple animation problems.

So it's a very powerful tool because you can write your reactions and animations in a discrete using discrete states and then do the transition.

These functions **withTiming** and **withSpring** are shipped with Reanimated tool, so you get it by default.
These functions **useTiming** and **useSpring** are shipped with Redash. So you could directly use these functions and be done with it.

```js
export const Transitions = () => {
  const [toggled, setToggle] = useState(false);
  return (
    <View style={styles.container}>
      {cards.slice(0, 3).map((card, index) => (
        <AnimatedCard key={card} {...{ index, card, toggled }} />
      ))}
      <Button
        label={toggled ? "Reset" : "Start"}
        primary
        onPress={() => setToggle((prev) => !prev)}
      />
    </View>
  );
};
```

We have state toggled that we pass to AnimatedCard as parameter to decide the transformation. So if we look at ```AnimatedCard```.

```js
export const AnimatedCard = ({ card, toggled, index }) => {
  const rotate = toggled ? ((index - 1) * Math.PI)/6 : 0;
  return (
    <View key={card} style={[styles.overlay, {
      transform: [
        { translateX: origin },
        { rotate: `${rotate}rad` },
        { translateX: -origin },
      ],
    }]}>
      <Card {...{ card }} />
    </View>
  );
};
```

If toggled is true we calculate the rotation and transform. So if:
- If index is 0 we rotate to -30 degree.
- If index is 1 we rotate to 0 degree.
- If index is 2 we rotate to 30 degree.

Now to create animation we are going to use transition and what we are going to do is create shared value that follows the react state.

```js
const isToggled = useSharedValue(false);
useEffect(() => {
  isToggled.value = toggled;
}, [toggled, isToggled])
```  

Now we use ```useDerivedValue``` to create an animation value based on all the animation values
```js
const transition = useDerivedValue(() => {
  return withSpring(isToggled.value);
})
```

Now pass this ```transition``` props in place of ```toggled``` to ```AnimatedCard```.
```js
export const Transitions = () => {
  const [toggled, setToggle] = useState(false);
  const isToggled = useSharedValue(false);
  useEffect(() => {
    isToggled.value = toggled;
  }, [toggled, isToggled])
  const transition = useDerivedValue(() => {
    return withSpring(isToggled.value);
  })
  return (
    <View style={styles.container}>
      {cards.slice(0, 3).map((card, index) => (
        <AnimatedCard key={card} {...{ index, card, transition }} />
      ))}
      <Button
        label={toggled ? "Reset" : "Start"}
        primary
        onPress={() => setToggle((prev) => !prev)}
      />
    </View>
  );
};
```

Now in ```AnimatedCard``` in place of View use ```Animated.View``` and in place of inline trnasfrom style use computed style using ```useAnimatedStyle```.

```js
export const AnimatedCard = ({ card, transition, index }) => {
  const style = useAnimatedStyle(() => {
    const rotate = interpolate(transition.value, [0, 1], [0, (index - 1) * Math.PI / 6]);
    return {
      transform: [
        { translateX: origin },
        { rotate: `${rotate}rad` },
        { translateX: -origin },
      ],
    }
  });
  return (
    <Animated.View key={card} style={[styles.overlay, style]}>
      <Card {...{ card }} />
    </Animated.View>
  );
};
```

Now we have nice transition. When we always interpolate from 0 to 1. redash provide a function called ```mix``` and simplify it as below:

```js
const rotate = mix(transition.value, 0, (index - 1) * Math.PI / 6);
```

And in transition component use ```withTiming``` in place of ```withSpring```.

We can refactor the transition into a function, so the one we are going to use from redash or we can make it a generic function as below:

```js
const useSpring = (state) => {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = typeof state === "number" ? state : (state ? 1 : 0);
  }, [state, value]);
  return useDerivedValue(() => {
    return withSpring(value.value);
  })
}

export const Transitions = () => {
  const [toggled, setToggle] = useState(false);
  const transition = useSpring(toggled);
  return (
    <View style={styles.container}>
      {cards.slice(0, 3).map((card, index) => (
        <AnimatedCard key={card} {...{ index, card, transition }} />
      ))}
      <Button
        label={toggled ? "Reset" : "Start"}
        primary
        onPress={() => setToggle((prev) => !prev)}
      />
    </View>
  );
};
```

Similarly we can write generic ```useTiming``` function also we can pass ```config```, we can do the same with ```useSpring```:
```js
const useTiming = (state, config) => {
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = typeof state === "number" ? state : (state ? 1 : 0);
  }, [state, value]);
  return useDerivedValue(() => {
    return withTiming(value.value, config);
  })
}
```

So one more exercise we can do is, what if we transition on an animation value and not a state.
So it's going to be an animation value so react doesn't know if it's toggled or not.

```js
export const Transitions = () => {
  const toggled = useSharedValue(false);
  const transition = useDerivedValue(() => {
    return withSpring(toggled.value);
  });
  return (
    <View style={styles.container}>
      {cards.slice(0, 3).map((card, index) => (
        <AnimatedCard key={card} {...{ index, card, transition }} />
      ))}
      <Button
        label={toggled ? "Reset" : "Start"}
        primary
        onPress={() => toggled.value = !toggled.value}
      />
    </View>
  );
};
```

Now if we see button label doesn't change because react doesn't know the toggle state. 
Building ```withSpring``` and ```withTiming``` are going to be great exercise to build manually. To really understand how reanimate works.

# Higher Order Animation
In functional programming, **Higher Order Functions** are functions that can receive functions as parameters and return other functions.

In reanimated2 animations are first class citizens into the library and they can also receive animations as parameters and return animations. This means composability. So for instance, considering a simple timing animation such as this one:

```js
withTiming(1)
```

Now let's say you want to repeat the animation 5 times, you are going to simply wrap the animation into another animation, ```repeat``` with the 5 iteration parameter.

```js
repeat(withTiming(1), 5)
```

And maybe you want to add some delay, you are going to do the samething using ```delay``` function:
```js
delay(repeat(withTiming(1), 5), 1000)
```

In reanimated1 we had an example where we could start an animation, when the animation is looping you can pause the animation at any point and resume it whenever we want.
This example is very important because if you are able to:
- run an animation 
- loop the animation
- pause/resume the animation 

It means that you have developed a level of agility in dealing with animation that can take you very far and that can enable you to build complex animation.

In reanimated1 building such example was non-trivial, barrier to entry was quite high. But once you could go over this barrier to entry, you had developed a level of agility which could take you very far with reanimated1. 

In ```reanimated2```, if animations are truly composable this is how such an example should look like.

We have timing function which goes from 0 to 1.
```js
withTiming(1)
```

Then we loop indefinitely on this animation, so this is what -1 means, indefinite number of interactions. Then we add the true parameter which means reverse on the next iteration. Meaning that we go from 0 to 1 then from 1 to 0 and not back from 0 to 1.

```js
repeat(withTiming(1), -1, true)
```

And then if we want animation to be pausable and resumable, we simply pass this animation as parameter to ```withPause``` function.

```js
withPause(repeat(withTiming(1), -1, true), paused)
```

And we pass as parameter a shared animation value which tells us if the animation is paused or not.

Another example of composing animations we can look at is: 
With pan-gesture example we can add the bouncing effect to our card if it reaches the edges, using just ```withBouncing``` function and pass the animation and boundaries as parameters.

```js
onEnd: (event, ctx) => {
  translateX.value = withBouncing(withDecay({
    velocity: event.velocityX,
  }), 0, boundX);
  translateY.value = withBouncing(withDecay({
    velocity: event.velocityY,
  }), 0, boundY);
},
```

Now we can work on our ChatBubble example:
```js
const Timing = () => {
    const [play, setPlay] = useState(false);
    const progress = useSharedValue(null);
    return (
        <View style={style.container}>
            <ChatBubble progress={progress} />
            <Button title={play ? "Pause" : "Play"} onPress={() => {
                setPlay((prev) => !prev);
                if (progress.value === null) {
                    progress.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
                }
            }
            } />
        </View>
    )
}
export default Timing;
```

ChatBubble
```js
const ChatBubble = (progress) => {
    const bubbles = [0, 1, 2];
    const delta = 1 / bubbles.length;
    return (
        <View style={styles.root}>
            <View style={styles.container}>
                {bubbles.map((i) => {
                    const start = i * delta;
                    const end = start + delta;
                    return <Bubble key={i} {...{ start, end, progress }} />
                })}
            </View>
        </View>
    )
}
export default ChatBubble
```

Bubble
```js
const Bubble = ({ progress, start, end }) => {
    const style = useAnimatedStyle(() => {
        const opacity = interpolate(
            progress.value,
            [start, end],
            [0.5, 1],
            Extrapolate.CLAMP
        );
        const scale = interpolate(
            progress.value,
            [start, end],
            [1, 1.5],
            Extrapolate.CLAMP
        );
        return { opacity, transform: [{ scale }] }
    });
    return <Animated.View style={[style, styles.bubble]} />;
}
export default Bubble;
```

Now we have chat bubble with indefinite loop, now we want the animation to be pausable, resumable. So we need a shared value to tell us that animation should be paused or not.
It remembers the point where it was paused and also remembers the direction.

# Custom Animations
Now we are going to see how to build higher order animations, we would build three animations as part of it:
- **Decay animation** when we release the **Pan Gesture**
  - This decay animation is provided by default in **reanimated2**.
- **Higher Order Animation** takes another animation as parameter. It's going to be bouncing animation.
- **PauseAnimation** that we build in ChatBubble example. But it was black box for us. So we are going to learn how to build such animations.

## Decay Animation
```js
react-native-reanimated";

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
```

Then we can use it like below:
```js
const Gesture = ({ width, height }) => {
    const boundX = width - CARD_WIDTH
    const boundY = height - CARD_HEIGHT
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.offsetX = translateX.value
            ctx.offsetY = translateY.value
        },
        onActive: (event, ctx) => {
            translateX.value = clamp(ctx.offsetX + event.translationX, 0, boundX)
            translateY.value = clamp(ctx.offsetY + event.translationY, 0, boundY)
        },
        onEnd: ({ velocityX, velocityY }) => {
            translateX.value = withDecay(velocityX);
            translateY.value = withDecay(velocityY);
        }
    })
    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value }
            ]
        }
    })
    return (
        <View style={styles.container}>
            <PanGestureHandler {...{ onGestureEvent }}>
                <Animated.View {...{ style }}>
                    <Card card={Cards.Card1} />
                </Animated.View>
            </PanGestureHandler>
        </View>
    )
}
```

## Higher Order Animation
```js
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
```
Then we can use it like below:
```js
const Gesture = ({ width, height }) => {
    const boundX = width - CARD_WIDTH
    const boundY = height - CARD_HEIGHT
    const translateX = useSharedValue(0)
    const translateY = useSharedValue(0)
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.offsetX = translateX.value
            ctx.offsetY = translateY.value
        },
        onActive: (event, ctx) => {
            translateX.value = clamp(ctx.offsetX + event.translationX, 0, boundX)
            translateY.value = clamp(ctx.offsetY + event.translationY, 0, boundY)
        },
        onEnd: ({ velocityX, velocityY }) => {
            translateX.value = withBounce(withDecay(velocityX), 0, boundX);
            translateY.value = withBounce(withDecay(velocityY), onGestureEvent, boundY);
        }
    })
    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value }
            ]
        }
    })
    return (
        <View style={styles.container}>
            <PanGestureHandler {...{ onGestureEvent }}>
                <Animated.View {...{ style }}>
                    <Card card={Cards.Card1} />
                </Animated.View>
            </PanGestureHandler>
        </View>
    )
}
```

## Pausable/Resumable Animation
```js
export const withPause = (animationParam, paused) => {
    "worklet";

    return defineAnimation(() => {
        "worklet";
        const nextAnimation = animationParameter(animationParam);
        const animation = (state, now) => {
            if (paused.value) {
                state.elapsed = now - state.lastTimestamp;
                return false;
            }
            const finished = nextAnimation.animation(nextAnimation, now - state.elapsed);
            state.current = nextAnimation.current;
            state.lastTimestamp = now;
            return finished;
        }
        const start = (state, value, now, previousAnimation) => {
            state.elapsed = 0;
            state.lastTimestamp = now;
            nextAnimation.start(nextAnimation, value, now, previousAnimation);

        }
        return {
            animation,
            start
        }
    })
}
```

# Circular Slider
In order to build such cool user interaction, we are going to deploy two interesting recipes:
- **Trigonometry** to be able to calculate the position of the cursor that you see, depending on the position of our finger.
- **SVG Animation** to calculate the length of the arc of the circle that represents the progress.

https://excalidraw.com

The way we are going to build the cursor moving around is that we have a pan gesture handler. We move our finger around and we are going to get the polar coordinate of our finger (r, θ) and we are going to convert it into canvas coordinate system.

**CircularSlider**
```js
import { Dimensions, PixelRatio, StyleSheet, View } from "react-native";
import Animated, { interpolateColor, useDerivedValue, useSharedValue } from "react-native-reanimated";
import { Cursor } from "./Cursor";
import { CircularProgress } from "./CircularProgress";
import { canvas2Polar } from "react-native-redash";
import { StyleGuide } from "./components/StyleGuide";

const { width } = Dimensions.get("window");
const size = width - 32;
const STROKE_WIDTH = 40;
const r = PixelRatio.roundToNearestPixel(size / 2);
const defaultTheta = canvas2Polar({ x: 0, y: 0 }, { x: r, y: r }).theta;
const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    content: {
        width: r * 2,
        height: r * 2,
    },
});

export const CircularSlider = () => {
    const theta = useSharedValue(defaultTheta);
    const backgroundColor = useDerivedValue(() => {
        return interpolateColor(
            theta.value,
            [0, Math.PI, Math.PI * 2],
            ["#ff3884", StyleGuide.palette.primary, "#38ffb3"]
        );
    });
    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Animated.View style={StyleSheet.absoluteFill}>
                    <CircularProgress backgroundColor={backgroundColor} strokeWidth={STROKE_WIDTH} {...{ r }} {...{ theta }} />
                </Animated.View>
                <Cursor strokeWidth={STROKE_WIDTH} r={r - STROKE_WIDTH / 2} backgroundColor={backgroundColor} {...{ theta }} />
            </View>
        </View>
    );
};
```

**CircularProgress**
```js
import { StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { StyleGuide } from "./components/StyleGuide";
import Animated, { useAnimatedProps } from "react-native-reanimated";

const { PI } = Math;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const CircularProgress = ({ theta, r, strokeWidth, backgroundColor }) => {
    const radius = r - strokeWidth / 2;
    const circumference = radius * 2 * PI;
    const props = useAnimatedProps(() => {
        return {
            stroke: backgroundColor.value,
            strokeDashoffset: theta.value * radius,
        }
    })
    return (
        <Svg style={StyleSheet.absoluteFill}>
            <Circle
                cx={r}
                cy={r}
                fill="transparent"
                stroke="white"
                r={radius}
                {...{ strokeWidth }}
            />
            <AnimatedCircle
                animatedProps={props}
                cx={r}
                cy={r}
                fill="transparent"
                r={radius}
                stroke={StyleGuide.palette.primary}
                strokeDasharray={`${circumference}, ${circumference}`}
                {...{ strokeWidth }}
            />
        </Svg>
    );
};
```

**Cursor.js**
```js
import * as React from "react";
import { StyleSheet, View } from "react-native";

import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, { clamp, useAnimatedGestureHandler, useAnimatedStyle } from "react-native-reanimated";
import { canvas2Polar, polar2Canvas } from "react-native-redash";
import { StyleGuide } from "./components/StyleGuide";

export const Cursor = ({ r, strokeWidth, theta, backgroundColor }) => {
    const center = { x: r, y: r };
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (event, ctx) => {
            ctx.offset = polar2Canvas({ theta: theta.value, radius: r }, center);
        },
        onActive: (event, ctx) => {
            const { translationX, translationY } = event;
            const x = ctx.offset.x + translationX;
            const y1 = ctx.offset.y + translationY;
            const y = x < r ? y1 : (theta.value < Math.PI ? clamp(y1, 0, r - 0.001) : clamp(y1, r, 2 * r))
            const value = canvas2Polar({ x, y }, center).theta;
            theta.value = value > 0 ? value : 2 * Math.PI + value;
            console.log({
                before: value,
                after: theta.value,
            })
        }
    });
    const style = useAnimatedStyle(() => {
        const { translateX, translateY } = polar2Canvas({ theta: theta.value, radius: r }, center);
        return {
            backgroundColor: backgroundColor.value,
            transform: [
                { translateX },
                { translateY }
            ]
        }
    })
    return (
        <PanGestureHandler {...{ onGestureEvent }}>
            <Animated.View
                style={[
                    {
                        ...StyleSheet.absoluteFillObject,
                        width: strokeWidth,
                        height: strokeWidth,
                        borderRadius: strokeWidth / 2,
                        borderColor: "white",
                        borderWidth: 5,
                        backgroundColor: StyleGuide.palette.primary,
                    },
                    { style }
                ]}
            />
        </PanGestureHandler>
    );
};
```

# Graph Interactions
This is super exciting for 3 reasons:
- Reanimated2 API is much simpler API because we can use JavaScript only on the UI thread. Here we are going to see that it's not only a better API, it's much more powerful API as well. Because in this case we will be formatting the JavaScript values on the UI thread. 
  - That was not possible with **reanimated1**. In **reanimated1** to implement such an example, we had to cross the bridge everytime, basically the cursor was moving. So we had to use request animation frame, we had to use some throttling, we had to use set native props no trigger render while we update the values. And this was not very performant on low-end devices.  
  - Here with **reanimated2** we are not crossing the bridge, everything is done on UI thread. So **reanimated2** is enabling new usecases, which were not possible to do before.
- We have some code sharing between the **JavaScript Thread** and **UI Thread**. E.g. changing formatting or changing legend while moving the cursor. 
- We are using **SVG Tuning**. We are using simple **Bezier tooling** and these are much more easier and robust to use with **reanimated2**.

https://cubic-bezier.com/

**Graph.js**
```js
import { View, Dimensions, StyleSheet } from "react-native";
import Svg, { Path, Defs, Stop, LinearGradient } from "react-native-svg";
import * as shape from "d3-shape";
import { interpolate, Extrapolate, useSharedValue, useDerivedValue } from "react-native-reanimated";

import { parsePath, getPointAtLength } from "./components/AnimatedHelpers";

import { Cursor } from "./Cursor";
import { Label } from "./Label";

const { width } = Dimensions.get("window");
const height = width;
const data = [
    { x: new Date(2020, 5, 1), y: 4371 },
    { x: new Date(2020, 5, 2), y: 6198 },
    { x: new Date(2020, 5, 3), y: 5310 },
    { x: new Date(2020, 5, 4), y: 7188 },
    { x: new Date(2020, 5, 5), y: 8677 },
    { x: new Date(2020, 5, 6), y: 5012 },
].map((p) => [p.x.getTime(), p.y]);

const domain = {
    x: [Math.min(...data.map(([x]) => x)), Math.max(...data.map(([x]) => x))],
    y: [Math.min(...data.map(([, y]) => y)), Math.max(...data.map(([, y]) => y))],
};

const range = {
    x: [0, width],
    y: [height, 0],
};

const scale = (v, d, r) => {
    "worklet";
    return interpolate(v, d, r, Extrapolate.CLAMP);
};

const scaleInvert = (y, d, r) => {
    "worklet";
    return interpolate(y, r, d, Extrapolate.CLAMP);
};

const d = shape
    .line()
    .x(([x]) => scale(x, domain.x, range.x))
    .y(([, y]) => scale(y, domain.y, range.y))
    .curve(shape.curveBasis)(data);
const path = parsePath(d);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
    },
});

export const Graph = () => {
    const length = useSharedValue(0);

    const point = useDerivedValue(() => {
        const coord = getPointAtLength(path, length.value);
        return {
            coord,
            data: {
                x: scaleInvert(coord.x, domain.x, range.x),
                y: scaleInvert(coord.y, domain.y, range.y),
            }
        }
    })
    return (
        <View style={styles.container}>
            <Label {...{ data, point }} />
            <View>
                <Svg {...{ width, height }}>
                    <Defs>
                        <LinearGradient x1="50%" y1="0%" x2="50%" y2="100%" id="gradient">
                            <Stop stopColor="#CDE3F8" offset="0%" />
                            <Stop stopColor="#eef6fd" offset="80%" />
                            <Stop stopColor="#FEFFFF" offset="100%" />
                        </LinearGradient>
                    </Defs>
                    <Path
                        fill="transparent"
                        stroke="#367be2"
                        strokeWidth={5}
                        {...{ d }}
                    />
                    <Path
                        d={`${d}  L ${width} ${height} L 0 ${height}`}
                        fill="url(#gradient)"
                    />
                </Svg>
                <Cursor {...{ path, length, point }} />
            </View>
        </View>
    );
};
```

**Cursor.js**
```js
/* eslint-disable react-native/no-unused-styles */

import { View, StyleSheet, Dimensions } from "react-native";
import { PanGestureHandler } from "react-native-gesture-handler";
import Animated, { Extrapolation, interpolate, useAnimatedGestureHandler, useAnimatedStyle, withDecay } from "react-native-reanimated";

const CURSOR = 100;
const { width } = Dimensions.get("window");
const styles = StyleSheet.create({
    cursorContainer: {
        width: CURSOR,
        height: CURSOR,
        justifyContent: "center",
        alignItems: "center",
        //backgroundColor: "rgba(100, 200, 300, 0.4)",
    },
    cursor: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderColor: "#367be2",
        borderWidth: 4,
        backgroundColor: "white",
    },
});

export const Cursor = ({ path, length, point }) => {
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (event, ctx) => {
            ctx.offsetX = interpolate(length.value, [0, path.length], [0, width], Extrapolation.CLAMP)
        },
        onActive: (event, ctx) => {
            length.value = interpolate(ctx.offsetX + event.translationX, [0, width], [0, path.length], Extrapolation.CLAMP)
        },
        onEnd: ({ velocityX: velocity }) => {
            length.value = withDecay({ velocity, clamp: [0, path.length] })
        }
    });
    const style = useAnimatedStyle(() => {
        const translateX = point.value.coord.x - CURSOR / 2;
        const translateY = point.value.coord.y - CURSOR / 2;
        return {
            transform: [{ translateX }, { translateY }]
        }
    });
    return (
        <View style={StyleSheet.absoluteFill}>
            <PanGestureHandler {...{ onGestureEvent }}>
                <Animated.View style={[styles.cursorContainer, style]}>
                    <View style={styles.cursor} />
                </Animated.View>
            </PanGestureHandler>
        </View>
    );
};
```

**Label.js**
```js
import { View, StyleSheet } from "react-native";
import { StyleGuide } from "./components/StyleGuide";
import { ReText } from "react-native-redash";
import { useDerivedValue } from "react-native-reanimated";

const styles = StyleSheet.create({
    date: {
        ...StyleGuide.typography.title3,
        textAlign: "center",
    },
    price: {
        ...StyleGuide.typography.title2,
        textAlign: "center",
    },
});

console.log({ styles });

export const Label = ({ point }) => {
    const date = useDerivedValue(() => {
        return new Date(point.value.data.x).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    })
    const price = useDerivedValue(() => {
        return `$ ${Math.round(point.value.data.y, 2).toLocaleString("en-US", { currency: "USD" })}`
    })
    return (
        <View>
            <ReText style={styles.date} text={date} />
            <ReText style={styles.price} text={price} />
        </View>
    );
};
```

# Swiping
We are going to use two very generic recipes that you can use in most of your code. What is this recipe: 

It's simply to have a pan gesture handler when we start the gesture, we remember the position so we keep an offset value. When the gesture is active we translate the value so whatever is the value of pan gesture handler plus the offset value and when we release we decide on where to snap. 
For this we use a function from react-native-redash which is super simple, it calculates where would be the position in 200ms depending the position and velocity and based on that it selects the closest point and that's where we are going to spring. 

There is another recipe which is pretty generic, so we have this gesture which drives the animation but we can also execute the gesture imperatively by clicking a button. This is also a very common usecase. E.g. you can see this in spotify player.

There are some specific thing that we might need to do only in this example:
- Because we have this tinder card rotation when we move on x-axis, we need to calculate the minimum distance to swipe to the left or to the right where we hide the card.
- We have spring configuration and nicely bounces the card but when we swipe to the left or to the right we execute a side effect, we say okay it's a like or a dislike. We want once the card is not visible to the user anymore we want to execute this side effect as soon as possible. We don't want to wait to have this small oscillation which gives a nice effect because we can't see the card anyways. So we are going to change the configuration of the spring depending on where we snap and namely where we are going to change two parameters which are the displacement threshold and the speed. So when do we decide that animation is over? So if we swipe to the left or to the right even if the speed of the translation is high we want the animation to stop since we can't see it anyways so we can execute the side effect as soon as possible.
- We have scale animation, so if the card is swiped to the left or to the right card below gets closer. So it feels like you see a new card on the stack is appearing.

**Swiping.js**
```js
import * as React from "react";

import { Profiles } from "./Profiles";

export const profiles = [
  {
    id: "1",
    name: "Caroline",
    age: 24,
    profile: require("./assets/1.jpg"),
  },
  {
    id: "2",
    name: "Jack",
    age: 30,
    profile: require("./assets/2.jpg"),
  },
  {
    id: "3",
    name: "Anet",
    age: 21,
    profile: require("./assets/3.jpg"),
  },
  {
    id: "4",
    name: "John",
    age: 28,
    profile: require("./assets/4.jpg"),
  },
];

export const Swiping = () => {
  return <Profiles {...{ profiles }} />;
};
```

**Profiles.js**
```js
import React, { useCallback, useState } from "react";
import { SafeAreaView, StyleSheet, View } from "react-native";
import { Feather as Icon } from "@expo/vector-icons";
import { RectButton } from "react-native-gesture-handler";
import { StyleGuide } from "./components/StyleGuide";
import { Swipeable } from "./Swipable";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: StyleGuide.palette.background,
        justifyContent: "space-evenly",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 16,
    },
    cards: {
        flex: 1,
        marginHorizontal: 16,
        zIndex: 100,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "space-evenly",
        padding: 16,
    },
    circle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        padding: 12,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
        shadowColor: "gray",
        shadowOffset: { width: 1, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
    },
});

export const Profiles = ({ profiles: defaultProfiles }) => {
    const [profiles, setProfiles] = useState(defaultProfiles);
    const onSwipe = useCallback(() => {
        setProfiles(profiles.slice(0, profiles.length - 1));
    }, [profiles]);
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Icon name="user" size={32} color="gray" />
                <Icon name="message-circle" size={32} color="gray" />
            </View>
            <View style={styles.cards}>
                {profiles.map((profile, index) => {
                    const onTop = index === profiles.length - 1;
                    return (
                        <Swipeable
                            key={profile.id}
                            profile={profile}
                            onSwipe={onSwipe}
                            onTop={onTop}
                        />
                    );
                })}
            </View>
            <View style={styles.footer}>
                <RectButton style={styles.circle}>
                    <Icon name="x" size={32} color="#ec5288" />
                </RectButton>
                <RectButton style={styles.circle}>
                    <Icon name="heart" size={32} color="#6ee3b4" />
                </RectButton>
            </View>
        </SafeAreaView>
    );
};
```

**Swipable.js**
```js
import { PanGestureHandler } from "react-native-gesture-handler";
import { A, Profile } from "./Profile";
import Animated, { runOnJS, useAnimatedGestureHandler, useSharedValue, withSpring } from "react-native-reanimated";
import { StyleSheet } from "react-native";
import { snapPoint } from "react-native-redash";

const snapPoints = [-A, 0, A];

export const Swipeable = ({ profile, onTop, onSwipe }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.x = translateX.value;
            ctx.y = translateY.value;
        },
        onActive: ({ translationX, translationY }, ctx) => {
            translateX.value = translationX + ctx.x;
            translateY.value = translationY + ctx.y;
        },
        onEnd: ({ velocityX, velocityY }) => {
            // snapPoint calculates the closest point based on the velocity to snap
            const dest = snapPoint(translateX.value, velocityX, snapPoints);
            translateX.value = withSpring(dest, { velocity: velocityX }, () => {
                if (dest !== 0) {
                    // run the side-effect on JS thread
                    runOnJS(onSwipe)();
                }
            });
            translateY.value = withSpring(0, { velocity: velocityY });
        }
    })
    return (
        <PanGestureHandler {...{ onGestureEvent }}>
            <Animated.View style={StyleSheet.absoluteFill}>
                <Profile profile={profile} onTop={onTop} translateX={translateX} translateY={translateY} />
            </Animated.View>
        </PanGestureHandler>
    );
};
```

**Profile.js**
```js
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

const { width, height } = Dimensions.get("window");
export const α = Math.PI / 12;
export const A = Math.sin(α) * height + Math.cos(α) * width;
const styles = StyleSheet.create({
    image: {
        ...StyleSheet.absoluteFillObject,
        width: undefined,
        height: undefined,
        borderRadius: 8,
    },
    overlay: {
        flex: 1,
        justifyContent: "space-between",
        padding: 16,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    footer: {
        flexDirection: "row",
    },
    name: {
        color: "white",
        fontSize: 32,
    },
    like: {
        borderWidth: 4,
        borderRadius: 5,
        padding: 8,
        borderColor: "#6ee3b4",
    },
    likeLabel: {
        fontSize: 32,
        color: "#6ee3b4",
        fontWeight: "bold",
    },
    nope: {
        borderWidth: 4,
        borderRadius: 5,
        padding: 8,
        borderColor: "#ec5288",
    },
    nopeLabel: {
        fontSize: 32,
        color: "#ec5288",
        fontWeight: "bold",
    },
});

export const Profile = ({ profile, translateX, translateY }) => {
    const style = useAnimatedStyle(() => {
        return {
            transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
        };
    });
    return (
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
            <Image style={styles.image} source={profile.profile} />
            <View style={styles.overlay}>
                <View style={styles.header}>
                    <View style={[styles.like]}>
                        <Text style={styles.likeLabel}>LIKE</Text>
                    </View>
                    <View style={[styles.nope]}>
                        <Text style={styles.nopeLabel}>NOPE</Text>
                    </View>
                </View>
                <View style={styles.footer}>
                    <Text style={styles.name}>{profile.name}</Text>
                </View>
            </View>
        </Animated.View>
    );
};
```

On issue is it took so much time for animation to be over and for this side effect to run. To fix that what we are going to do: if ```dest``` is not zero we are going to change the spring config so the animation finishes superfast and we're gonna tackle two parameters, first one is ```restSpeedThreshold``` and second one is ```restDisplacementThreshold```.

```js
onEnd: ({ velocityX, velocityY }) => {
    // snapPoint calculates the closest point based on the velocity to snap
    const dest = snapPoint(translateX.value, velocityX, snapPoints);
    translateX.value = withSpring(dest, { velocity: velocityX, restSpeedThreshold: dest === 0 ? 0.01 : 100, restDisplacementThreshold: dest === 0 ? 0.01 : 100 }, () => {
        if (dest !== 0) {
            // run the side-effect on JS thread
            runOnJS(onSwipe)();
        }
    });
    translateY.value = withSpring(0, { velocity: velocityY });
}
```

Now we are going to scale the background card. In ```Swipable.js``` we change the scale in the ```onActive``` handler and pass it as props to ```Profile.js```as below:
```js
export const Swipeable = ({ scale, profile, onTop, onSwipe }) => {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const onGestureEvent = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.x = translateX.value;
            ctx.y = translateY.value;
        },
        onActive: ({ translationX, translationY }, ctx) => {
            translateX.value = translationX + ctx.x;
            translateY.value = translationY + ctx.y;
            scale.value = interpolate(translateX.value, [-width / 2, 0, width / 2], [1, 0.95, 1], Extrapolation.CLAMP)
        },
        onEnd: ({ velocityX, velocityY }) => {
            // snapPoint calculates the closest point based on the velocity to snap
            const dest = snapPoint(translateX.value, velocityX, snapPoints);
            translateX.value = withSpring(dest, { velocity: velocityX, restSpeedThreshold: dest === 0 ? 0.01 : 100, restDisplacementThreshold: dest === 0 ? 0.01 : 100 }, () => {
                if (dest !== 0) {
                    // run the side-effect on JS thread
                    runOnJS(onSwipe)();
                }
            });
            translateY.value = withSpring(0, { velocity: velocityY });
        }
    })
    return (
        <PanGestureHandler {...{ onGestureEvent }}>
            <Animated.View style={StyleSheet.absoluteFill}>
                <Profile profile={profile} onTop={onTop} translateX={translateX} translateY={translateY} scale={scale} />
            </Animated.View>
        </PanGestureHandler>
    );
};
```

And we transform the Profile with scale.

**Profile.js**
```js
export const Profile = ({ scale, profile, translateX, translateY }) => {
    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: interpolate(translateX.value, [-width / 2, 0, width / 2], [α, 0, -α], Extrapolation.CLAMP) + " deg" },
                { scale: scale.value }
            ],
        };
    });
    const like = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [0, width / 4], [0, 1], Extrapolation.CLAMP)
        }
    })
    const nope = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [-width / 4, 0], [1, 0], Extrapolation.CLAMP)
        }
    })
    return (
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
            <Image style={styles.image} source={profile.profile} />
            <View style={styles.overlay}>
                <View style={styles.header}>
                    <Animated.View style={[styles.like, like]}>
                        <Text style={styles.likeLabel}>LIKE</Text>
                    </Animated.View>
                    <Animated.View style={[styles.nope, nope]}>
                        <Text style={styles.nopeLabel}>NOPE</Text>
                    </Animated.View>
                </View>
                <View style={styles.footer}>
                    <Text style={styles.name}>{profile.name}</Text>
                </View>
            </View>
        </Animated.View>
    );
};
```

Now let's implement imperative command, below is the code from ```Swipable.js``` used for swipe right, lets refactor it and put it into another function:
```js
translateX.value = withSpring(dest, { velocity: velocityX, restSpeedThreshold: dest === 0 ? 0.01 : 100, restDisplacementThreshold: dest === 0 ? 0.01 : 100 }, () => {
    if (dest !== 0) {
        // run the side-effect on JS thread
        runOnJS(onSwipe)();
    }
});
```

Will execute this function on hit of the button. Second thing that we need to do is to use hook ```useImperativeHandle``` where we can create methods that we can use from the outside. So you see how on the text input you can do ```.focus``` or ```.blur```. We also need to use ```forwardRef``` so we can assign the ref get it within the component.

**Swipable.js**
```js
const swipe = (translateX, dest, velocityX, onSwipe) => {
    "worklet";
    translateX.value = withSpring(dest, { velocity: velocityX, restSpeedThreshold: dest === 0 ? 0.01 : 100, restDisplacementThreshold: dest === 0 ? 0.01 : 100 }, () => {
        if (dest !== 0) {
            // run the side-effect on JS thread
            runOnJS(onSwipe)();
        }
    });
}
```

We can also use ```useCallback``` and define it inside the component, so we don't need to pass that many parameters.

Next thing we need to do is use **forwardRef** and access ref as props as below:
```js
const Swipeable = ({ scale, profile, onTop, onSwipe }, ref) => {
  ....
  useImperativeHandle(ref, () => ({
        swipeLeft: () => {
            swipe(translateX, -A, 25, onSwipe);
        },
        swipeRight: () => {
            swipe(translateX, A, 25, onSwipe);
        }
    }))
}
export default forwardRef(Swipeable);
```

Now we invoke these methods from ```Profiles.js```.
```js
export const Profiles = ({ profiles: defaultProfiles }) => {
    const topCard = useRef(null);
    const scale = useSharedValue(1);
    const [profiles, setProfiles] = useState(defaultProfiles);
    const onSwipe = useCallback(() => {
        setProfiles(profiles.slice(0, profiles.length - 1));
    }, [profiles]);
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Icon name="user" size={32} color="gray" />
                <Icon name="message-circle" size={32} color="gray" />
            </View>
            <View style={styles.cards}>
                {profiles.map((profile, index) => {
                    const onTop = index === profiles.length - 1;
                    const ref = onTop ? topCard : null;
                    return (
                        <Swipeable
                            ref={ref}
                            scale={scale}
                            key={profile.id}
                            profile={profile}
                            onSwipe={onSwipe}
                            onTop={onTop}
                        />
                    );
                })}
            </View>
            <View style={styles.footer}>
                <RectButton style={styles.circle} onPress={() => topCard.current?.swipeLeft()}>
                    <Icon name="x" size={32} color="#ec5288" />
                </RectButton>
                <RectButton style={styles.circle} onPress={() => topCard.current?.swipeRight()}>
                    <Icon name="heart" size={32} color="#6ee3b4" />
                </RectButton>
            </View>
        </SafeAreaView>
    );
};
```
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
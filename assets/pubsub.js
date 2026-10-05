const subscribers = {};
function subscribe(eventName, callback) {
  if (subscribers[eventName] === undefined) subscribers[eventName] = [];
  subscribers[eventName] = [...subscribers[eventName], callback];
  return () => { subscribers[eventName] = subscribers[eventName].filter((subscriber) => subscriber !== callback); };
}
function publish(eventName, data) { if (subscribers[eventName]) subscribers[eventName].forEach((callback) => callback(data)); }

const regEx = (function(){
    const float = "\\d*\\.\\d+";
    const int = "\\d+\\.?";
    const variable = "[a-zA-Z]\\w*";
    const stuff = "[^()]*?(?:\\(.*?\\)[^()]*?)*?";
    const bracket = "\\(" + stuff + "\\)";
    const func = variable + bracket;

    function value(str){
        return new RegExp("^\\s*" + str + "\\s*$");
    }

    function operator(...args){
        return new RegExp("^(" + stuff + ")(" + args.join("|") + ")(" + stuff + ")$");
    }

    const input = "^(?:\\s*(" + variable + ")(" + bracket + ")?\\s*[=:→])?(.+)$";

    return {
        float: value(float),
        int: value(int),
        variable: value(variable),
        func: value(func),
        bracket: value("\\((" + stuff + ")\\)"),

        add: operator("[+-]"),
        mult: operator("(?!^)[*/]"),


        input: new RegExp(input),
        whitespace: /^\s*$/
    };
})();

const operators = {
    add: {
        enum: 1,
        symbols: {
            "+": "add",
            "-": "sub"
        }
    },

    mult: {
        enum: 2,
        symbols: {
            "*": "mult",
            "/": "div"
        }
    }
};

function parseOperatorChain(obj, operator, symbol, str){
    function append(value){
        let key = operators[operator].symbols[symbol];
        if(obj[key] instanceof Array)
            obj[key].push(value);
        else
            obj[key] = [value];
    }

    let result = str.match(regEx[operator]);
    if(result){
        append(parse(result[1]));
        parseOperatorChain(obj, operator, result[2], result[3]);
    } else
        append(parse(str));
}

function parse(str){
    //if string is a bracket, parse the content of it
    let result = str.match(regEx.bracket);
    if(result)
        str = result[1];

    //if it is a number, return it
    if(str.match(regEx.float))
        return parseFloat(str);
    if(str.match(regEx.int))
        return parseInt(str);

    for(let operator in operators){
        let result = str.match(regEx[operator]);

        if(!result)
            continue;

        let obj = {
            type: operators[operator].enum
        };

        if(result[1])
            obj[operator] = [parse(result[1])];

        parseOperatorChain(obj, operator, result[2], result[3]);
        return obj;
    }

    throw "Token `" + str + "` could not be parsed.";
}

function calculate(obj){
    if(!(obj instanceof Object))
        return obj;

    let result = 0;

    if(obj.type === operators.add.enum){
        if(obj.add){
            obj.add.forEach(function(value){
                result += calculate(value);
            });
        }

        if(obj.sub){
            obj.sub.forEach(function(value){
                result -= calculate(value);
            });
        }
    } else if(obj.type === operators.mult.enum){
        result = 1;
        if(obj.mult){
            obj.mult.forEach(function(value){
                result *= calculate(value);
            });
        }

        if(obj.div){
            obj.div.forEach(function(value){
                value = calculate(value);

                if(value === 0)
                    throw "Division with 0 is not defined";

                result /= value;
            });
        }
    }

    return result;
}
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

function parse(str, meta){
    //if string is a bracket, parse the content of it
    let result = str.match(regEx.bracket);
    if(result)
        str = result[1];

    //if it is a number, return it
    if(str.match(regEx.float))
        return parseFloat(str);
    if(str.match(regEx.int))
        return parseInt(str);

    if(str.match(regEx.variable)){
        let symbol = str.trim();

        if(symbol === "x")
            meta.type = "func";
        else if(meta.deps.indexOf(symbol) === -1)
            meta.deps.push(symbol);

        return symbol;
    }

    for(let operator in operators){
        let result = str.match(regEx[operator]);

        if(!result)
            continue;

        let obj = {
            type: operators[operator].enum
        };

        if(result[1])
            obj[operator] = [parse(result[1], meta)];

        parseOperatorChain(obj, operator, result[2], result[3], meta);
        return obj;
    }

    throw "Token `" + str + "` could not be parsed.";
}

function parseOperatorChain(obj, operator, symbol, str, meta){
    function append(value){
        let key = operators[operator].symbols[symbol];
        if(obj[key] instanceof Array)
            obj[key].push(value);
        else
            obj[key] = [value];
    }

    let result = str.match(regEx[operator]);
    if(result){
        append(parse(result[1], meta));
        parseOperatorChain(obj, operator, result[2], result[3]);
    } else
        append(parse(str, meta));
}

function calculate(obj, res){
    //no calculation to do on numbers
    if(typeof obj === "number")
        return obj;

    //look up for a variable
    if(typeof obj === "string"){
        if(res.vars[obj] !== undefined)
            return res.vars[obj];

        throw "Variable or constant `%s` not found".format(obj);
    }

    let result = 0;

    if(obj.type === operators.add.enum){
        if(obj.add){
            obj.add.forEach(function(value){
                result += calculate(value, res);
            });
        }

        if(obj.sub){
            obj.sub.forEach(function(value){
                result -= calculate(value, res);
            });
        }
    } else if(obj.type === operators.mult.enum){
        result = 1;
        if(obj.mult){
            obj.mult.forEach(function(value){
                result *= calculate(value, res);
            });
        }

        if(obj.div){
            obj.div.forEach(function(value){
                value = calculate(value, res);

                if(value === 0)
                    throw "Division with 0 is not defined";

                result /= value;
            });
        }
    }

    return result;
}

function createFunction(term){
    let str = "return " + stringify(term) + ";";
    return Function.constructor.call(null, ["x", "vars"], str);
}

function stringify(term, before = 0){
    if(typeof term === "number")
        return term;

    if(typeof term === "string"){
        if(term === "x")
            return "x";
        else
            return "vars." + term; //use the resources object
    }

    for(let operator in operators){
        operator = operators[operator];

        if(term.type === operator.enum){
            let str = "";

            if(before > term.type)
                str += "(";

            for(let symbol in operator.symbols){
                let name = operator.symbols[symbol];

                if(term[name]){
                    term[name].forEach(function(term){
                        if(str)
                            str += symbol;

                        str += stringify(term, operator.enum);
                    });
                }
            }

            if(before > term.type)
                str += ")";

            return str;
        }
    }

    throw "Could not turn term `" + JSON.stringify(term) + "` into a function string";
}

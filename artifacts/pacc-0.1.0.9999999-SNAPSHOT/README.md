# Process-as-Code Compiler/Decompiler #

This project implements a process-as-code translator that converts a custom language into/from the existing format consumed by the web UI.

**WARNING**
The translator may not yet enforce all rules.
Errors are not yet user friendly.
While errors should terminate translation, not all do so yet.
Translation, upload, and download scripts assume java is on the path.
Secure property definition patterns and defaults do not function correctly and should not be used.
Some fields that reference other objects in UCD can be uploaded with invalid values. Please ensure names and ids are correct.
When using triple quote syntax, triple quotes must be placed on newline. This restriction may be lifted later.

Due to how the server stores some information, using download feature to get processes can lead to extra properties in the downloaded pac file.
Future server versions may reject an upload of these pac files.
One example of this is the maxIteration property on run-generic-process-for-each-affected-resource is a duplicate of option max-concurrent-processes.

## Usage ##

### Command: `pacc` ###

```
pacc <input.pac >output.json
```

`pacc` translates a custom language for defining a deployment process into a format that can be uploaded to an unmodified server.
It takes input from standard in and writes the translation to standard out.
Errors are written to standard error.

### Command: `ccap` ###

```
ccap <input.json >output.pac
```

`ccap` translates the JSON deployment process format used by the server into the new process-as-code language consumed by `pacc`.
It takes input from standard in and writes the translation to standard out.
Errors are written to standard error.


### Command: `upload-*-process` ###

```
upload-<process-type>-process <user-name> <server-url> <process-id>  [<next-version>|latest] input.pac [--comment <comment>]
```

The upload scripts upload a process-as-code file to the server as a new version of a process.
All scripts have the same arguments and only differ according to the type of process that is uploaded.
If `<next-version>` is not specified, the process will be uploaded as the latest version.
The upload scripts work for processes defined on templates as well.
Example:
```
upload-application-process admin https://localhost:8443 1719934b-f6ec-58e1-4dbc-b1246652c2b1 23 deploy.pac
```

### Command: `download-*-process` ###

```
download-<process-type>-process <user-name> <server-url> <process-id> [<version>|latest] output.pac
```

The download scripts download a process from the server to a process-as-code file.
All scripts have the same arguments and differ according to the type of process that is downloaded.
The final argument specifies which numeric version to download or 'latest' for the latest version.
If the version is not specified, the latest version is downloaded.
The download scripts work for processes defined on templates as well.
Example:
```
download-application-process admin https://localhost:8443 1719934b-f6ec-58e1-4dbc-b1246652c2b1 latest deploy.pac
```

## Input Format ##

### Overall Syntax ###

```
-- Comments are indicated by a lead pair of dashes
```

The `start` block defines which steps will begin the process.
Multiple steps can be started concurrently by listing multiple starts

```
start is
    start "step-1"
    start "step-2"
end
```

Step blocks define steps and begin with a keyword for the kind of step and declare the name of the step.
Steps are linked together by name, so every step must have a unique name.

```
plugin step "step-1" is
    ...   -- explained later
end
```

Steps define what action to take after the step ends depending on the outcome.

```
plugin step "step-1" is
    ...
on success
    -- actions when the step succeeds
    start "step-2"
on failure
    -- actions when the step fails
    start "step-3"
on complete
    -- actions when the step completes regardless of success or failure
    start "step-4"
end
```

Each outcome can specify multiple actions.
The action 'finish' means to start the implicit finish step.

```
plugin step "step-1" is
    ...
on success
    start "step-2"
    start "step-3"
    start "step-4"
on failure
    finish
```

Certain steps allow nesting processes.

```
for-each-resource-tag step "frt1" is
    ... -- explained later

    start is
        start "step-1"
    end

    plugin step "step-1" is
        ...
    on success
        finish
    end
on success
    start "step-2"
end
```

Step names must unique across top-level and nested processes.
Nested process steps may only reference their nest mates.


### String Syntax ###

Strings are used to specify step names and other custom values.
Strings are specified by text surrounded by double quote characters.

```
"single quote"
```

Special characters can be embedded by escaping with a backslash.
Double quote, carriage return, new line, horizontal tab, and backslash itself may be escaped this way.

```
" \" \r \n \t \\ "
```

Strings can also be specified by triple quotes.
These strings do not allow escape characters, but they can extend over multiple lines or embed other special characters without quoting.

```
"""
cd C:\workdir
copy *.* "C:\Program Files\My Program"
"""
```

Triple quotes can be embedded in a triple quote string by doubling.

```
""" """""" <- becomes " repeated 3 times """
```

Multi-line triple quoted strings have the leading indent removed,
where the indent is determined by the identation of the opening triple quote.

For example,

```
    """
    for x in *.txt
    do
        echo $x
        cat $x
    done
    """
```

becomes

```
for x in *.txt
do
    echo $x
    cat $x
done
```


### Implemented Step Types ###

These are the currently implemented step types.
Refer to the main product documentation for more information about the behavior of each step in a process.

Any type of process can be defined with this language, but not all steps are valid in every type of process.

#### `start` ####

The `start` block is a pseudo-step that defines the beginning of the process.
As it is not a true step, it does not use the `step` keyword.
The only completion condition is success, so `on success` is not required or permitted.

```
start is
    -- list one or more actions
    start "foo"
    start "bar"
end
```


#### `acquire-lock` ####

The `acquire-lock` step allows acquisition of a process lock.

```
acquire-lock step "foo" is
    -- define the name of the lock; required
    lock "${p:component.name}-${p:componentProcess.name}-${p:resource.name}"
on success
    start "bar"
end
```


#### `add-inventory-status` ####

The `add-inventory-status` step adds a status to a component resource.

```
add-inventory-status step "foo" is
    -- name of the status to add to the component resource; required
    status "Active"
on success
    finish
end
```


#### `add-process-warning` ####

The `add-process-warning` step adds a warning message to the executing process.

```
add-process-warning step "foo" is
    -- a string in the body defines the warning; required
    "Warning: process partially successful"
on success
    finish
end
```


#### `application-manual-task` ####

The `application-manual-task` step pauses the process until a manual approval is completed.
This step is only valid in an application process.

```
application-manual-task step "foo" is
    -- users that can approve the task; required
    -- approval restriction to the deploying user
    restrict-approval-to deploying-user

    -- name of notification template; optional
    notification-template "TaskCompleted"

    -- property-definition establishes a property definition; optional, repeatable

    -- a text property definition with all options
    property-definition p1-text is text with
        -- label for the property definition; optional
        -- common to all property defintion types
        label "p1-label"

        -- description for the property definition; optional
        -- common to all property defintion types
        description "p1-description"

        -- regex pattern for the property definition's property values; optional
        -- an empty pattern is equivalent to ".*"
        -- common to all property defintion types
        pattern "p1-pattern-.*"

        -- a value is required for property defined by this property definition; optional
        -- common to all property defintion types
        required true

        -- default value for text properties created by this property definition; optional
        default "p1-pattern-default"
    end

    -- a text property definition with no options
    property-definition p2-text-simple is text

    -- a text area property definition with all options
    property-definition p3-textarea is text-area with
        -- common options; optional
        label "p3-label"
        description "p3-description"
        pattern ".*"
        required true

        -- default value for text area properties created by this property definition; optional
        default
            """
            p3-default-line1
            p3-default-line2
            p3-default-line3
            """
    end

    -- a text area property definition with no options
    property-definition p4-textarea-simple is text-area

    -- a text area property definition with all options
    property-definition p5-secure is secure with
        -- common options; optional
        label "p5-label"
        description "p5-description"

        -- default value for secure properties created by this property definition; optional
        -- currently, default values for secure properties do not function properly and their use is not recommended
        default "p5-pattern-default"
    end

    -- a secure property definition with no options
    property-definition p6-secure-simple is secure

    -- a checkbox property definition with all options
    property-definition p7-checkbox is checkbox with
        -- common options; optional
        label "p7-label"
        description "p7-description"
        pattern "true|false"
        required true

        -- default value for checkbox properties created by this property definition; optional
        -- permitted values are 'true' or 'false'
        default true
    end

    -- a checkbox property definition with no options
    property-definition p8-checkbox-simple is checkbox

    -- a date-time property definition with all options
    property-definition p9-datetime is date-time with
        -- common options; optional
        label "p9-label"
        description "p9-description"
        pattern ""
        required true

        -- default value for date-time properties created by this property definition; optional
        -- time is specified as milliseconds from 1970-01-01 00:00:00 UTC.
        default millis 1594814965125
    end

    -- a date-time property with an xml schema format default value
    property-definition p10-datetime-xml is date-time with
        -- default value for date-time properties created by this property definition; optional
        -- time is format is specified at https://www.w3.org/TR/xmlschema-2/#dateTime
        default xml "2000-01-20T12:00:00+12:00"
    end

    -- a date-time property definition with no options
    property-definition p11-datetime-simple is date-time

    -- a select property definition with all options
    -- at least one value must be supplied
    -- at most one value may be selected as the default value
    property-definition p12-select is select of
        -- a possible value in for the property; optional, repeatable
        value "p12-value1"

        -- a value with an optional label
        value "p12-value2" as "Value 2"

        -- a value with a label and optionally selected as the default value
        value "p12-value3" as "Value 3" selected
    with
        -- common otptions; optional
        label "p12-label"
        description "p12-description"
        pattern "p12-value.*"
        required true
    end

    -- a select property definition with an unlabeled value selected as the default and no common options
    property-definition p13-select-default-unlabeled is select of
        value "p13-value1" selected
        value "p13-value2"
        value "p13-value3"
    end

    -- a select property definition with no options
    property-definition p14-select-simple is select of
        value p14-value1
        value p14-value2
        value p14-value3
    end

    -- a multi-select property definition with all options
    -- a date-time property definition with all options
    -- one or more values may be selected as the default value
    property-definition p15-multiselect is multi-select of
        -- a possible value in for the property; optional, repeatable
        value "p15-value1"

        -- a value with a label and optionally selected as one of the default values
        value "p15-value2" as "Value 2" selected

        -- a value with a label and optionally selected as a second default value
        value "p15-value3" as "Value 3" selected
    with
        -- common options; optional
        label "p15-label"
        description "p15-description"
        pattern "p15-value.*"
        required true
    end

    -- a select property definition with an unlabeled values selected as the defaults and no common options
    property-definition p16-multiselect-default-unlabeled is multi-select of
        value "p16-value1" selected
        value "p16-value2" selected
        value "p16-value3"
    end

    -- a select property definition with a single unlabeled value selected as the default and no common options
    property-definition p17-multiselect-one-default is multi-select of
        value "p17-value1" selected
        value "p17-value2"
        value "p17-value3"
    end

    -- a multi-select property definition with no options
    property-definition p18-multiselect-simple is multi-select of
        value "p18-value1"
        value "p18-value2"
        value "p18-value3"
    end
on success
    finish
end

application-manual-task step "bar" is
    -- approval restricted to certain application roles
    -- at least one role must be supplied
    restrict-approval-to application-roles of
        -- role name on the standard resource type; optional, repeatable
        -- before 7.1.1.0, the role must be specified with a database ID
        role "role1"

        -- role on a custom resource type; optional, repeatable
        -- before 7.1.1.0, the resource type must be specified with a database ID
        role "role2" for "resourcetype1"
    end
end

application-manual-task step "baz" is
    -- approval restricted to certain environment roles
    -- at least one role must be supplied
    restrict-approval-to environment-roles of
        role "role3"
        role "role4" for "resourcetype2"
    end
end

application-manual-task step "quux" is
    -- approval restricted to any user
    restrict-approval-to any-user
end
```

#### `application-run-component-process` ####

The `application-run-component-process` step executes a component process and waits for it to complete.
This step is only valid in an application process.

```
application-run-component-process step "foo" is
    -- name of the component to deploy; required
    component "my-component"

    -- name of the component process to run for each component; required
    process "deploy-my-component"

    -- select resources to run on by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "res-tag-1"

    -- select resources to run on based on inventory changes in other components; optional
    select-resources-by-changed-component-list
        -- select components to monitor for inventory changes; optional, repeatable
        -- before 7.1.1.0, the component must be specified by internal database ID
        component "comp-1"
        component "comp-2"

        -- specify which resources of this process's component are selected; required
        --   all - select all resources where this process's component is mapped
        --   with-changed-component - select only resources where both this process's component
        --                            and a monitored component are mapped and the monitored
        --                            component has changed
        select-resources all
    end

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"
on success
    finish
end
```


#### `apply-configuration` ####

The `apply-configuration` step starts child component processes for applying configuration changes.
This step is only valid in an application process.

```
apply-configuration step "foo" is
    -- name of the component to configure; required
    component "my-component"

    -- name of the component process to run; required
    -- must be a configuration deployment or a no-version-needed operational process
    process "deploy-component-process-property"

    -- select resources to apply to by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "my-tag"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"

on success
    start "bar"
end
```


#### `component-manual-task` ####

The `component-manual-task` step pauses the process until a manual approval is completed.
This step is only valid in a component process.

```
component-manual-task step "foo" is
    -- users that can approve the task; required
    -- approval restriction to the deploying user
    restrict-approval-to deploying-user

    -- name of notification template; optional
    notification-template "TaskCompleted"

    -- property-definition establishes a property definition; optional, repeatable

    -- a text property definition with all options
    property-definition p1-text is text with
        -- label for the property definition; optional
        -- common to all property defintion types
        label "p1-label"

        -- description for the property definition; optional
        -- common to all property defintion types
        description "p1-description"

        -- regex pattern for the property definition's property values; optional
        -- an empty pattern is equivalent to ".*"
        -- common to all property defintion types
        pattern "p1-pattern-.*"

        -- a value is required for property defined by this property definition; optional
        -- common to all property defintion types
        required true

        -- default value for text properties created by this property definition; optional
        default "p1-pattern-default"
    end

    -- a text property definition with no options
    property-definition p2-text-simple is text

    -- a text area property definition with all options
    property-definition p3-textarea is text-area with
        -- common options; optional
        label "p3-label"
        description "p3-description"
        pattern ".*"
        required true

        -- default value for text area properties created by this property definition; optional
        default
            """
            p3-default-line1
            p3-default-line2
            p3-default-line3
            """
    end

    -- a text area property definition with no options
    property-definition p4-textarea-simple is text-area

    -- a text area property definition with all options
    property-definition p5-secure is secure with
        -- common options; optional
        label "p5-label"
        description "p5-description"

        -- default value for secure properties created by this property definition; optional
        -- currently, default values for secure properties do not function properly and their use is not recommended
        default "p5-pattern-default"
    end

    -- a secure property definition with no options
    property-definition p6-secure-simple is secure

    -- a checkbox property definition with all options
    property-definition p7-checkbox is checkbox with
        -- common options; optional
        label "p7-label"
        description "p7-description"
        pattern "true|false"
        required true

        -- default value for checkbox properties created by this property definition; optional
        -- permitted values are 'true' or 'false'
        default true
    end

    -- a checkbox property definition with no options
    property-definition p8-checkbox-simple is checkbox

    -- a date-time property definition with all options
    property-definition p9-datetime is date-time with
        -- common options; optional
        label "p9-label"
        description "p9-description"
        pattern ""
        required true

        -- default value for date-time properties created by this property definition; optional
        -- time is specified as milliseconds from 1970-01-01 00:00:00 UTC.
        default millis 1594814965125
    end

    -- a date-time property with an xml schema format default value
    property-definition p10-datetime-xml is date-time with
        -- default value for date-time properties created by this property definition; optional
        -- time is format is specified at https://www.w3.org/TR/xmlschema-2/#dateTime
        default xml "2000-01-20T12:00:00+12:00"
    end

    -- a date-time property definition with no options
    property-definition p11-datetime-simple is date-time

    -- a select property definition with all options
    -- at least one value must be supplied
    -- at most one value may be selected as the default value
    property-definition p12-select is select of
        -- a possible value in for the property; optional, repeatable
        value "p12-value1"

        -- a value with an optional label
        value "p12-value2" as "Value 2"

        -- a value with a label and optionally selected as the default value
        value "p12-value3" as "Value 3" selected
    with
        -- common otptions; optional
        label "p12-label"
        description "p12-description"
        pattern "p12-value.*"
        required true
    end

    -- a select property definition with an unlabeled value selected as the default and no common options
    property-definition p13-select-default-unlabeled is select of
        value "p13-value1" selected
        value "p13-value2"
        value "p13-value3"
    end

    -- a select property definition with no options
    property-definition p14-select-simple is select of
        value p14-value1
        value p14-value2
        value p14-value3
    end

    -- a multi-select property definition with all options
    -- a date-time property definition with all options
    -- one or more values may be selected as the default value
    property-definition p15-multiselect is multi-select of
        -- a possible value in for the property; optional, repeatable
        value "p15-value1"

        -- a value with a label and optionally selected as one of the default values
        value "p15-value2" as "Value 2" selected

        -- a value with a label and optionally selected as a second default value
        value "p15-value3" as "Value 3" selected
    with
        -- common options; optional
        label "p15-label"
        description "p15-description"
        pattern "p15-value.*"
        required true
    end

    -- a select property definition with an unlabeled values selected as the defaults and no common options
    property-definition p16-multiselect-default-unlabeled is multi-select of
        value "p16-value1" selected
        value "p16-value2" selected
        value "p16-value3"
    end

    -- a select property definition with a single unlabeled value selected as the default and no common options
    property-definition p17-multiselect-one-default is multi-select of
        value "p17-value1" selected
        value "p17-value2"
        value "p17-value3"
    end

    -- a multi-select property definition with no options
    property-definition p18-multiselect-simple is multi-select of
        value "p18-value1"
        value "p18-value2"
        value "p18-value3"
    end
on success
    finish
end

component-manual-task step "bar" is
    -- approval restricted to certain application roles
    -- if present, at least one role must be supplied
    restrict-approval-to application-roles of
        -- role name on the standard resource type; optional, repeatable
        -- before 7.1.1.0, the role must be specified with a database ID
        role "role1"

        -- role on a custom resource type; optional, repeatable
        -- before 7.1.1.0, the resource type must be specified with a database ID
        role "role2" for "resourcetype1"
    end
end

component-manual-task step "baz" is
    -- approval restricted to certain environment roles
    -- if present, at least one role must be supplied
    restrict-approval-to environment-roles of
        role "role3"
        role "role4" for "resourcetype2"
    end
end

component-manual-task step "quux" is
    -- approval restricted to certain component roles
    -- if present, at least one role must be supplied
    restrict-approval-to component-roles of
        role "role5"
        role "role6" for "resourcetype3"
    end
end

component-manual-task step "quuux" is
    -- approval restricted to any user
    restrict-approval-to any-user
end
```


#### `component-run-component-process` ####

The `component-run-component-process` step executes a component process and waits for it to complete.
This step is only valid in a component process.

```
component-run-component-process step "foo" is

    -- name of the component process to run; required
    process "deploy-my-component"

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"
on success
    finish
end
```


#### `for-each-agent` ####

The `for-each-agent` step allows an embedded process definition to be run for each agent in an environment.
This step is only valid in an application process.

```
for-each-agent step "loop1" is
    -- define target resource tags; optional, repeatable
    -- before 7.1.1.0, the tag must be specified by internal database ID
    tag "res-tag-1"
    tag "res-tag-2"

    -- maximum number of agents to target concurrently; optional
    -- default is unlimited
    max-concurrent-agents unlimited

    -- must contain an embedded 'start' block that works like the top-level version
    start is
        start "install-c1"
    end

    -- contains one or more embedded steps of any type except for other for-each steps
    install-component step "install-c1" is
        component "c1"
        process "deploy"
        without-status "Active"
        fail-fast true
        ignore-child-warnings true
        max-concurent-processes 43

    -- on success/failure/complete reference steps inside the for-each
    -- 'finish' refers to the implied finish step inside the for-each
    on success
        finish
    end

-- on success/failure/complete outside an embedded step reference steps in the top-level process
on success
    start "next-step"
end
```

#### `for-each-resource-tag` ####

The `for-each-resource-tag` step allows an embedded process definition to be run for resources selected by a set of tags.
This step is only valid in an application process.

The `for-each-resource-tag` step is called a "For Each Tag" in the web UI.

```
for-each-resource-tag step "loop1" is
    -- define target resource tags; required, repeatable
    -- before 7.1.1.0, the tag must be specified by internal database ID
    tag "res-tag-a1"
    tag "res-tag-a2"

    -- maximum number of tags to target concurrently; optional
    -- default is 1
    max-concurrent-tags 1

    -- must contain an embedded 'start' block that works like the top-level version
    start is
        start "install-c1"
    end

    -- contains one or more embedded steps of any type except for other for-each steps
    install-component step "install-c1" is
        component "c1"
        process "deploy"
        without-status "Active"
        fail-fast true
        ignore-child-warnings true
        max-concurent-processes 43

    -- on success/failure/complete reference steps inside the for-each
    -- 'finish' refers to the implied finish step inside the for-each
    on success
        finish
    end

-- on success/failure/complete outside an embedded step reference steps in the top-level process
on success
    start "next-step"
end
```


#### `generic-manual-task` ####

The `generic-manual-task` step pauses the process until a manual approval is completed.
This step is only valid in a generic process.

```
generic-manual-task step "foo" is
    -- users that can approve the task; required
    -- approval restriction to the deploying user
    restrict-approval-to deploying-user

    -- name of notification template; optional
    notification-template "TaskCompleted"

    -- require a user comment when approving the task; optional
    -- default is false
    comment-required true

    -- the prompt for a user comment when approving the task; optional
    comment-prompt "Enter reason"

    -- property-definition establishes a property definition; optional, repeatable

    -- a text property definition with all options
    property-definition p1-text is text with
        -- label for the property definition; optional
        -- common to all property defintion types
        label "p1-label"

        -- description for the property definition; optional
        -- common to all property defintion types
        description "p1-description"

        -- regex pattern for the property definition's property values; optional
        -- an empty pattern is equivalent to ".*"
        -- common to all property defintion types
        pattern "p1-pattern-.*"

        -- a value is required for property defined by this property definition; optional
        -- common to all property defintion types
        required true

        -- default value for text properties created by this property definition; optional
        default "p1-pattern-default"
    end

    -- a text property definition with no options
    property-definition p2-text-simple is text

    -- a text area property definition with all options
    property-definition p3-textarea is text-area with
        -- common options; optional
        label "p3-label"
        description "p3-description"
        pattern ".*"
        required true

        -- default value for text area properties created by this property definition; optional
        default
            """
            p3-default-line1
            p3-default-line2
            p3-default-line3
            """
    end

    -- a text area property definition with no options
    property-definition p4-textarea-simple is text-area

    -- a text area property definition with all options
    property-definition p5-secure is secure with
        -- common options; optional
        label "p5-label"
        description "p5-description"
        pattern "p5-pattern-.*" -- currently, patterns for secure properties do not function properly and their use is not recommended
        required true

        -- default value for secure properties created by this property definition; optional
        -- currently, default values for secure properties do not function properly and their use is not recommended
        default "p5-pattern-default"
    end

    -- a secure property definition with no options
    property-definition p6-secure-simple is secure

    -- a checkbox property definition with all options
    property-definition p7-checkbox is checkbox with
        -- common options; optional
        label "p7-label"
        description "p7-description"
        pattern "true|false"
        required true

        -- default value for checkbox properties created by this property definition; optional
        -- permitted values are 'true' or 'false'
        default true
    end

    -- a checkbox property definition with no options
    property-definition p8-checkbox-simple is checkbox

    -- a date-time property definition with all options
    property-definition p9-datetime is date-time with
        -- common options; optional
        label "p9-label"
        description "p9-description"
        pattern ""
        required true

        -- default value for date-time properties created by this property definition; optional
        -- time is specified as milliseconds from 1970-01-01 00:00:00 UTC.
        default millis 1594814965125
    end

    -- a date-time property with an xml schema format default value
    property-definition p10-datetime-xml is date-time with
        -- default value for date-time properties created by this property definition; optional
        -- time is format is specified at https://www.w3.org/TR/xmlschema-2/#dateTime
        default xml "2000-01-20T12:00:00+12:00"
    end

    -- a date-time property definition with no options
    property-definition p11-datetime-simple is date-time

    -- a select property definition with all options
    -- at least one value must be supplied
    -- at most one value may be selected as the default value
    property-definition p12-select is select of
        -- a possible value in for the property; optional, repeatable
        value "p12-value1"

        -- a value with an optional label
        value "p12-value2" as "Value 2"

        -- a value with a label and optionally selected as the default value
        value "p12-value3" as "Value 3" selected
    with
        -- common otptions; optional
        label "p12-label"
        description "p12-description"
        pattern "p12-value.*"
        required true
    end

    -- a select property definition with an unlabeled value selected as the default and no common options
    property-definition p13-select-default-unlabeled is select of
        value "p13-value1" selected
        value "p13-value2"
        value "p13-value3"
    end

    -- a select property definition with no options
    property-definition p14-select-simple is select of
        value p14-value1
        value p14-value2
        value p14-value3
    end

    -- a multi-select property definition with all options
    -- a date-time property definition with all options
    -- one or more values may be selected as the default value
    property-definition p15-multiselect is multi-select of
        -- a possible value in for the property; optional, repeatable
        value "p15-value1"

        -- a value with a label and optionally selected as one of the default values
        value "p15-value2" as "Value 2" selected

        -- a value with a label and optionally selected as a second default value
        value "p15-value3" as "Value 3" selected
    with
        -- common options; optional
        label "p15-label"
        description "p15-description"
        pattern "p15-value.*"
        required true
    end

    -- a select property definition with an unlabeled values selected as the defaults and no common options
    property-definition p16-multiselect-default-unlabeled is multi-select of
        value "p16-value1" selected
        value "p16-value2" selected
        value "p16-value3"
    end

    -- a select property definition with a single unlabeled value selected as the default and no common options
    property-definition p17-multiselect-one-default is multi-select of
        value "p17-value1" selected
        value "p17-value2"
        value "p17-value3"
    end

    -- a multi-select property definition with no options
    property-definition p18-multiselect-simple is multi-select of
        value "p18-value1"
        value "p18-value2"
        value "p18-value3"
    end
on success
    finish
end

generic-manual-task step "bar" is
    -- approval restricted to certain users and groups
    -- if present, at least one user or group must be supplied
    restrict-approval-to identities
        -- list of approving users; optional
        -- if present, at least one user must be listed
        users of
            -- a user that can approve; repeatable
            user Alice
        end

        -- list of approving groups; optional
        -- if present, at least one group must be listed
        groups of
            -- a group that can approve; repeatable
            group DevOpsTeam
        end
    end
end
```


#### `install-component` ####

The `install-component` step starts child component processes for installing a single component.
This step is only valid in an application process.

```
install-component step "foo" is
    -- name of the component to deploy; required
    component "my-component"

    -- name of the component process to run for each component; required
    process "deploy-component-process-property"

    -- select versions for deployment without this inventory status; required
    select-versions-without-inventory-status "Active"

    -- select resources to deploy to by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "my-tag"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"

on success
    start "bar"
end
```


#### `install-multiple-components` ####

The `install-multiple-components` step starts child component processes for installing multiple components.
This step is only valid in an application process.

```
install-multiple-components step "foo" is
    -- name of the component process to run for each component; required
    process "deploy"

    -- select versions for deployment without this inventory status; required
    select-versions-without-inventory-status "Active"

    -- select components to deploy by component tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-components-by-tag "comp-tag-a"

    -- select resources to deploy to by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "res-tag-a"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes per component; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- maximum number of components to deploy concurrently; optional
    -- default is 100
    max-concurrent-components 100

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

on success
    start "bar"
end
```

#### `join` ####

The `join` step halts further process progress until incoming steps are completed.
The only completion condition is success, so `on success` is not required or permitted.

```
join step "foo" is
    finish
end
```


#### `plugin` ####

The `plugin` step allows executing any plugin command.
Consult with the plugin documentation or implementation to find the specific values required to configure it.
This step is not valid in an application process.

```
plugin step "foo" is
    -- define name of plugin; required
    plugin "Shell"

    -- define name of plugin command; required
    command "Shell"

    -- absolute path of the working directory for the step; optional
    -- if undefined, the default working directory for the process is used
    working-directory "/working/directory"

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
       """
       true
       """

    -- define properties that configure the step; optional
    -- may be repeated
    property "prop1" = "value1"
    property "prop2" = "value2"
on success
    start "bar"
end
```


#### `release-lock` ####
The `release-lock` step allows release of a process lock.

```
release-lock step "foo" is
    -- define the name of the lock; required
    lock "${p:component.name}-${p:componentProcess.name}-${p:resource.name}"
on success
    start "bar"
end
```


#### `remove-inventory-status` ####

The `remove-inventory-status` step removes a status from a component resource.

```
remove-inventory-status step "foo" is
    -- name of the status to remove from the component resource; required
    status "Active"
on success
    finish
end
```


#### `rollback-component` ####

The `rollback-component` step starts child component processes for rolling back a single component.
This step is only valid in an application process.

```
rollback-component step "foo" is
    -- name of the component to deploy; required
    component "my-component"

    -- name of the component process to run for each component; required
    process "deploy-component-process-property"

    -- mode for selecting versions to rollback; required
    --   remove-undesired-incremental-versions - rollback incremental versions
    --   replace-with-last-deployed - rollback to previous version
    rollback-type replace-with-last-deployed

    -- select versions for rollback with this inventory status; required
    select-versions-with-inventory-status "Active"

    -- select resources to rollback on by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "my-tag"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"

on success
    start "bar"
end
```


#### `rollback-multiple-components` ####

The `rollback-multiple-components` step starts child component processes for rolling back multiple components.
This step is only valid in an application process.

```
rollback-multiple-components step "foo" is
    -- name of the component process to run for each component; required
    process "deploy"

    -- mode for selecting versions to rollback; required
    --   remove-undesired-incremental-versions - rollback incremental versions
    --   replace-with-last-deployed - rollback to previous version
    rollback-type replace-with-last-deployed

    -- select versions for rollback with this inventory status; required
    select-versions-with-inventory-status "Active"

    -- select components to rollback by component tag; optional
    -- currently, the tag must be specified by internal database ID
    select-components-by-tag "1714f9ea-1aa0-405d-f8df-ae131fcee7be"

    -- select resources to rollback by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "my-tag"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes per component; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- maximum number of components to uninstall concurrently; optional
    -- default is 100
    max-concurrent-components 100

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

on success
    start "bar"
end
```


#### `run-generic-process` ####

The `run-generic-process` step executes a generic process and waits for it to complete.

```
run-generic-process step "foo" is
    -- name of the component process to run; required
    process "generic-process-1"

    -- resource tree path where process will execute; optional
    -- default is the process's default path
    resource-path "${p:resource.path}"

    -- suppress warnings generated by child; optional
    -- default is false
    ignore-child-warnings true

    -- set a process property value; optional, repeatable
    property "prop-1" = "prop-value-1"
```


#### `run-generic-process-for-each-affected-resource` ####

The `run-generic-process-for-each-affected-resource` step executes a generic process for each resource affected by the application process and waits for it to complete.
This step is only valid in an application process.

```
run-generic-process-for-each-affected-resource step "foo" is
    -- name of the generic process to run for each affected resource; required
    process "generic-process-1"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a generic process property value; optional, repeatable
    property "generic-process-property-1" = "cpp1-value"
    property "generic-process-property-2" = "cpp1-value"
on success
    finish
end
```


#### `run-operational-process-for-multiple-components` ####

The `run-operational-process-for-multiple-components` step executes a component operational process for multiple components and waits for them to complete.
This step is only valid in an application process.

```
run-operational-process-for-multiple-components "foo" is
    -- name of the component process to run for each component; required
    process "my-component-operation"

    -- select components to target by component tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-components-by-tag "my-tag"

    -- select resources to run on by resource tag; optional
    -- currently, the tag must be specified by internal database ID
    select-resources-by-tag "171603dd-389d-3183-c496-5ca60f4378f2"

    -- select resources to run on based on inventory changes in other components; optional
    select-resources-by-changed-component-tag
        -- select components to monitor for inventory changes by tag; optional
        -- currently, the tag must be specified by internal database ID
        select-components-by-tag "1714f9ea-1aa0-405d-f8df-ae131fcee7be"

        -- specify which resources of this process's component are selected; required
        --   all - select all resources where this process's component is mapped
        --   with-changed-component - select only resources where both this process's component
        --                            and a monitored component are mapped and the monitored
        --                            component has changed
        select-resources all
    end

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- only run on one online resource; optional
    -- default is false
    run-on-first-online-resource-only true

    -- maximum number of concurrent processes per component; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- maximum number of components to deploy concurrently; optional
    -- default is 100
    max-concurrent-components 100

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

on success
    finish
end
```


#### `run-process-for-each-version` ####

The `run-process-for-each-version` step runs a component processes for each version of the component.
This step is only valid in an application process.

```
run-process-for-each-version step "foo" is
    -- name of the component to target; required
    component "my-component"

    -- name of the component process to run for each version; required
    process "deploy-component-process-property"

    -- select resources to target by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "my-tag"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- only run on one online resource; optional
    -- default is false
    run-on-first-online-resource-only true

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"

on success
    start "bar"
end
```


#### `set-final-process-status` ####

The `set-final-process-status` step forces the outcome status of a process to success or failure.

```
set-final-process-status step "foo" is
    -- set workflow result to 'success' or 'failure'; required
    status success
on success
    finish
end
```


#### `shell` ####

The `shell` step is a shortcut for a `plugin` step that specifies the "Shell" plugin and the "Shell" command.
This step is not valid in an application process.

```
shell step "foo" is
    -- a string in the body defines the script; required
    """
    msg="hello world A"
    echo $msg
    """

    -- run the script without waiting for it to complete; optional
    -- "output.log" is the path of a file that captures the output
    run-as-daemon "output.log"

    -- absolute path of the working directory for the step; optional
    -- if undefined, the default working directory for the process is used
    working-directory "/working/directory"

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
       """
       true
       """
on success
    start "bar"
end
```


#### `switch` ####

The `switch` step allows decision logic in the process.
It expands a variable by name or evaluates an expression containing a 'p' expressions to a value.
Based on the value, one case is selected and its actions are carried out.

```
switch step "foo" is
    -- a variable or ${p:expression} to evaluate
    evaluate "variable"

-- case selected if the expression evaluates to "A"
on case "A"
    -- one or more start commands
    start "step-a"

-- additional cases follow
on case "B"
    start "step-b"

-- case selected if no other expression matches; optional
-- if present, this must be the final option
on default
    start "step-default"
end
```


#### `uninstall-component` ####

The `uninstall-component` step starts child component processes for uninstalling a single component.
This step is only valid in an application process.

```
uninstall-component step "foo" is
    -- name of the component to deploy; required
    component "my-component"

    -- name of the component process to run for each component; required
    process "deploy-component-process-property"

    -- mode for selecting versions to uninstall; required
    --   all - uninstall all versions installed
    --   selected-with-process - uninstall versions selected with the process
    select-versions all

    -- select versions for deployment with this inventory status; required
    select-versions-with-inventory-status "Active"

    -- select resources to uninstall from by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "my-tag"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

    -- set a component process property value; optional, repeatable
    property "component-process-property-1" = "cpp1-value"
    property "component-process-property-2" = "cpp1-value"

on success
    start "bar"
end
```


#### `uninstall-multiple-components` ####

The `uninstall-multiple-components` step starts child component processes for uninstalling multiple components.
This step is only valid in an application process.

```
uninstall-multiple-components step "foo" is
    -- name of the component process to run for each component; required
    process "deploy"

    -- mode for selecting versions to uninstall; required
    --   all - uninstall all versions installed
    --   selected-with-process - uninstall versions selected with the process
    select-versions all

    -- select versions for uninstall with this inventory status; required
    select-versions-with-inventory-status "Active"

    -- select components to uninstall by component tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-components-by-tag "comp-tag-a"

    -- select resources to uninstall from by resource tag; optional
    -- before 7.1.1.0, the tag must be specified by internal database ID
    select-resources-by-tag "res-tag-a"

    -- don't start further children after a failure; optional
    -- default is false
    fail-fast false

    -- suppress warnings generated by children; optional
    -- default is false
    ignore-child-warnings false

    -- maximum number of concurrent processes per component; optional
    -- default is unlimited
    max-concurrent-processes unlimited

    -- maximum number of components to uninstall concurrently; optional
    -- default is 100
    max-concurrent-components 100

    -- javascript precondition script that must evaluate to true for the step to execute; optional
    precondition-script
        """
        true
        """

on success
    start "bar"
end
```

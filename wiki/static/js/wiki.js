$(function () {
    var onMobile = function () {
        $('#mobilePreview').show();
        $('#mobilePreview').click(function () {
            $('.togglePreview').toggle();
            var markdownText = $('#markdown').val();
            $('#content')
                .html(marked(markdownText));
        });

    };

    var onPc = function () {
        var simplemde = new SimpleMDE({
            autosave: {
                enabled: true,
                uniqueId: "new-item",
                delay: 1000,
            },
            element: document.getElementById("markdown"),
            initialValue: '# タイトル (必須)',
            shortcuts: {
                drawTable: "Cmd-Alt-T"
            },
            showIcons: ["code", "table"],
            spellChecker: false,
        });
    };

    if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
        onMobile();
    } else {
        onPc();
    }
});
